"""Serve the built Pages artifact on loopback HTTPS for credential UI tests."""
import ssl
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


if __name__ == "__main__":
    directory, port, cert, key = sys.argv[1:]
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert, key)
    handler = partial(SimpleHTTPRequestHandler, directory=directory)
    with ThreadingHTTPServer(("127.0.0.1", int(port)), handler) as server:
        server.socket = context.wrap_socket(server.socket, server_side=True)
        server.serve_forever()
