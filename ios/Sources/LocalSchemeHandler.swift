// LocalSchemeHandler — 번들 리소스를 커스텀 스킴(app://local/...)으로 서빙.
//
// 왜 필요한가: 이 게임은 ES 모듈(type="module")이라 file://로 loadFileURL 하면
// 모듈 import가 CORS 정책에 막혀 게임이 통째로 뜨지 않는다. WKURLSchemeHandler로
// 번들 파일을 올바른 MIME 타입과 함께 서빙하면 모듈 로딩이 정상 동작한다
// (이 머신의 악보연습 프로젝트에서 검증된 패턴).
import WebKit

final class LocalSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "app"

    private let mimeTypes: [String: String] = [
        "html": "text/html",
        "js": "text/javascript",
        "mjs": "text/javascript",
        "css": "text/css",
        "json": "application/json",
        "png": "image/png",
        "jpg": "image/jpeg",
        "svg": "image/svg+xml",
        "wasm": "application/wasm",
        "woff2": "font/woff2",
    ]

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }

        guard let resourceRoot = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let fileURL = resourceRoot.appendingPathComponent(String(path.dropFirst()))

        // 경로 탈출(../) 방지: 반드시 web/ 아래 파일만 서빙
        guard fileURL.standardizedFileURL.path.hasPrefix(resourceRoot.standardizedFileURL.path),
              let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let ext = fileURL.pathExtension.lowercased()
        let mime = mimeTypes[ext] ?? "application/octet-stream"
        let response = URLResponse(
            url: url,
            mimeType: mime,
            expectedContentLength: data.count,
            textEncodingName: "utf-8"
        )
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // 파일 서빙은 동기 완료라 취소할 진행 작업이 없음
    }
}
