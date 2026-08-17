// 심해 다이버 — WKWebView 래퍼 앱 델리게이트 (스토리보드 없이 코드로 윈도우 구성)
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = UIColor(red: 0.016, green: 0.027, blue: 0.051, alpha: 1) // 웹 배경(#04070d)과 동일
        window.rootViewController = GameViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}
