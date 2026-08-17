// GameViewController — 전체화면 WKWebView + 햅틱 브리지.
// 웹 쪽에서 webkit.messageHandlers.haptic.postMessage('hit'|'pickup'|'success')를
// 보내면 네이티브 햅틱으로 변환한다 (심사 4.2 웹뷰 래퍼 리스크 완화 + 손맛).
import UIKit
import WebKit

final class GameViewController: UIViewController, WKScriptMessageHandler {
    private var webView: WKWebView!

    // 제너레이터는 재사용해야 지연 없이 즉시 반응한다
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let notification = UINotificationFeedbackGenerator()

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.016, green: 0.027, blue: 0.051, alpha: 1)

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalSchemeHandler(), forURLScheme: LocalSchemeHandler.scheme)
        // Web Audio가 첫 사용자 탭 이후 소리 나도록 (자동재생 제스처 요구 해제)
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true
        config.userContentController.add(self, name: "haptic")

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        view.addSubview(webView)

        heavyImpact.prepare()
        lightImpact.prepare()
        notification.prepare()

        webView.load(URLRequest(url: URL(string: "app://local/index.html")!))
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "haptic", let kind = message.body as? String else { return }
        switch kind {
        case "hit":
            heavyImpact.impactOccurred()
            heavyImpact.prepare()
        case "pickup":
            lightImpact.impactOccurred()
            lightImpact.prepare()
        case "success":
            notification.notificationOccurred(.success)
            notification.prepare()
        default:
            break
        }
    }
}
