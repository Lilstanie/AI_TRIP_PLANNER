import AppKit
import WebKit

@MainActor
final class Browser: NSObject, ObservableObject {
    static let home = URL(string: "https://elec5620-ai-trip-planner.vercel.app")!
    static let appHosts: Set<String> = ["elec5620-ai-trip-planner.vercel.app", "more-puma-666.clerk.accounts.dev"]
    static let defaultTitle = "AI Trip Planner"
    private static let offlineErrors: Set<Int> = [
        NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost, NSURLErrorCannotFindHost,
        NSURLErrorCannotConnectToHost, NSURLErrorTimedOut, NSURLErrorDNSLookupFailed,
        NSURLErrorInternationalRoamingOff, NSURLErrorDataNotAllowed,
    ]

    let webView: WKWebView
    @Published private(set) var title = Browser.defaultTitle
    @Published private(set) var canGoBack = false
    @Published private(set) var canGoForward = false
    private var observations: [NSKeyValueObservation] = []
    weak var window: NSWindow? {
        didSet { tintTitleBar() }
    }

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.applicationNameForUserAgent = "TripPlannerMacApp"
        configuration.websiteDataStore = .default()
        configuration.preferences.isElementFullscreenEnabled = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsMagnification = true
        observations = [
            webView.observe(\.title) { [weak self] webView, _ in
                Task { @MainActor in
                    let title = webView.title ?? ""
                    self?.title = title.isEmpty ? Browser.defaultTitle : title
                }
            },
            webView.observe(\.canGoBack) { [weak self] webView, _ in
                Task { @MainActor in self?.canGoBack = webView.canGoBack }
            },
            webView.observe(\.canGoForward) { [weak self] webView, _ in
                Task { @MainActor in self?.canGoForward = webView.canGoForward }
            },
            webView.observe(\.underPageBackgroundColor) { [weak self] _, _ in
                Task { @MainActor in self?.tintTitleBar() }
            },
        ]
        goHome()
    }

    func goHome() {
        webView.load(URLRequest(url: Self.home))
    }

    func reload() {
        if webView.url?.isFileURL == true { goHome() } else { webView.reload() }
    }

    func setZoom(_ zoom: CGFloat) {
        webView.pageZoom = min(max(zoom, 0.5), 3)
    }

    func changeZoom(by step: CGFloat) {
        setZoom(webView.pageZoom + step)
    }

    private func tintTitleBar() {
        guard let window else { return }
        window.titlebarAppearsTransparent = true
        window.backgroundColor = webView.underPageBackgroundColor
    }

    static func opensInApp(_ url: URL) -> Bool {
        switch url.scheme {
        case "about", "blob", "data", "file":
            return true
        case "https":
            return url.host.map(appHosts.contains) ?? false
        default:
            return false
        }
    }

    private func showOffline() {
        guard let page = Bundle.main.url(forResource: "offline", withExtension: "html") else { return }
        webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
    }

    private func alert(_ message: String, buttons: [String]) -> NSApplication.ModalResponse {
        let alert = NSAlert()
        alert.messageText = message
        buttons.forEach { alert.addButton(withTitle: $0) }
        return alert.runModal()
    }
}

extension Browser: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else { return .cancel }
        if navigationAction.shouldPerformDownload { return .download }
        if Self.opensInApp(url) || navigationAction.targetFrame?.isMainFrame == false { return .allow }
        NSWorkspace.shared.open(url)
        return .cancel
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        navigationResponse.canShowMIMEType ? .allow : .download
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let error = error as NSError
        if error.domain == NSURLErrorDomain && Self.offlineErrors.contains(error.code) { showOffline() }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}

extension Browser: WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }
        if Self.opensInApp(url) { webView.load(navigationAction.request) } else { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async {
        _ = alert(message, buttons: ["OK"])
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async -> Bool {
        alert(message, buttons: ["OK", "Cancel"]) == .alertFirstButtonReturn
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo
    ) async -> String? {
        let alert = NSAlert()
        alert.messageText = prompt
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        let field = NSTextField(string: defaultText ?? "")
        field.frame = NSRect(x: 0, y: 0, width: 260, height: 24)
        alert.accessoryView = field
        alert.window.initialFirstResponder = field
        return alert.runModal() == .alertFirstButtonReturn ? field.stringValue : nil
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo) async -> [URL]? {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true
        return panel.runModal() == .OK ? panel.urls : nil
    }
}

extension Browser: WKDownloadDelegate {
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String) async -> URL? {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.directoryURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
        guard panel.runModal() == .OK, let url = panel.url else { return nil }
        try? FileManager.default.removeItem(at: url)
        return url
    }
}
