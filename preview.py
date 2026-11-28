"""Serve the local reading desk and its explicit, text-only online questions."""
import argparse
import http.client
import json
import sys
import threading
import portable_update
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.dont_write_bytecode = True
import reading_questions

ADDRESS = "127.0.0.1"
PORT = 4187
DIST = Path(__file__).resolve().parent / "dist"


class LocalPreviewServer(ThreadingHTTPServer):
    allow_reuse_address = False


class ReadingHandler(SimpleHTTPRequestHandler):
    def reply(self,status,data):
        encoded=json.dumps(data,ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.send_header("Content-Length",str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path not in ("/api/reading-options", "/api/portable-update"):
            return super().do_GET()
        if self.headers.get("Host")!=f"{ADDRESS}:{self.server.server_port}":
            return self.reply(403,{"error":"Use the local reading desk"})
        if self.path=="/api/portable-update":
            return self.reply(200,self.server.updater.status())
        return self.reply(200,reading_questions.options())

    def do_POST(self):
        if self.path not in ("/api/reading-question","/api/reading-outline","/api/reading-translation","/api/literature-search","/api/model-session","/api/portable-update"):
            return self.reply(404,{"error":"Unknown route"})
        authority=f"{ADDRESS}:{self.server.server_port}"
        if self.headers.get("Host")!=authority or self.headers.get("Origin")!="http://"+authority:
            return self.reply(403,{"error":"Open this workbench on its local address."})
        if self.headers.get_content_type()!="application/json":
            return self.reply(415,{"error":"Expected JSON"})
        try:
            size=int(self.headers.get("Content-Length","0"))
            if not 0<size<=65536:raise ValueError()
            body=json.loads(self.rfile.read(size))
            if self.path=="/api/portable-update":
                if not isinstance(body,dict) or set(body)!={"action"} or body["action"] not in ("check","install","restart"):
                    return self.reply(400,{"error":"Unknown update action"})
                updater=self.server.updater
                if not updater.enabled:
                    return self.reply(404,{"error":"Portable edition required"})
                if body["action"]=="restart":
                    if not updater.restart():
                        return self.reply(409,updater.status())
                    self.reply(200,updater.status())
                    self.server.restart_requested=True
                    threading.Thread(target=self.server.shutdown,daemon=True).start()
                    return
                return self.reply(200,updater.begin(body["action"]))
            if self.path=="/api/model-session":
                if not isinstance(body,dict) or set(body)!={'provider','key'} or not isinstance(body['provider'],str):
                    raise ValueError()
                reading_questions.providers.set_session_key(body['provider'],body['key'])
                return self.reply(200,reading_questions.options())
            if self.path=="/api/literature-search":
                if not isinstance(body,dict) or set(body)!={'query'}:raise ValueError()
                query=reading_questions.text(body['query'],120,True)
                rows,status=reading_questions.public_literature.lookup(query)
                return self.reply(200,{'literature':rows,'search':{'query':query,'status':status,'count':len(rows)}})
            validator,respond={
                "/api/reading-outline":(reading_questions.outline_payload,reading_questions.outline),
                "/api/reading-translation":(reading_questions.translation_payload,reading_questions.translate_selection)
            }.get(self.path,(reading_questions.payload,reading_questions.answer))
            data=validator(body)
        except (ValueError,TypeError,KeyError):
            return self.reply(400,{"error":"请确认选区、问题和公开分享范围。 / Check the selection and question."})
        try:
            result=respond(data)
        except reading_questions.ReaderError as exc:
            return self.reply(503,{"error":str(exc)})
        except (OSError,ValueError,KeyError,TypeError):
            return self.reply(502,{"error":"回答未能完整接收，请重试。 / The answer could not be received."})
        self.reply(200,result)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=PORT)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    url=f"http://{ADDRESS}:{args.port}/"
    handler=partial(ReadingHandler,directory=str(DIST))
    try:
        server=LocalPreviewServer((ADDRESS,args.port),handler)
    except OSError:
        try:
            conn=http.client.HTTPConnection(ADDRESS,args.port,timeout=3)
            try:
                conn.request("GET","/")
                response=conn.getresponse()
                same_app=response.status==200 and b"./panel-desk.js" in response.read()
                if same_app and portable_update.Updater().enabled:
                    conn.request("GET","/api/portable-update")
                    info=conn.getresponse()
                    existing=info.read(16384)
                    if info.status != 200 or json.loads(existing).get("current") != portable_update.VERSION or not json.loads(existing).get("enabled"):
                        sys.exit("请先关闭旧阅读器的启动窗口，再双击新版 start.cmd。\nClose the other Reading Desk window that started the local service, then run start.cmd again.")
            finally:conn.close()
        except OSError:same_app=False
        if not same_app:sys.exit(f"Port {args.port} is occupied. Close the other local service and retry.")
        if not args.no_browser:webbrowser.open(url)
        return
    server.updater=portable_update.Updater()
    server.updater.started()
    server.restart_requested=False
    print(url,flush=True)
    if not args.no_browser:webbrowser.open(url)
    with server:
        try:server.serve_forever()
        except KeyboardInterrupt:pass
    if server.restart_requested:sys.exit(75)


if __name__=="__main__":
    main()
