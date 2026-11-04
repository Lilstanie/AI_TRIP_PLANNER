import SwiftUI
import WebKit

@main
struct TripPlannerApp: App {
    var body: some Scene {
        WindowGroup {
            TripWindow()
        }
        .defaultSize(width: 1280, height: 820)
        .commands { TripCommands() }
    }
}

struct TripWindow: View {
    @StateObject private var browser = Browser()

    var body: some View {
        TripWebView(browser: browser)
            .frame(minWidth: 900, minHeight: 600)
            .navigationTitle(browser.title)
            .focusedSceneObject(browser)
    }
}

struct TripWebView: NSViewRepresentable {
    let browser: Browser

    func makeNSView(context: Context) -> WebContainer { WebContainer(browser: browser) }

    func updateNSView(_ nsView: WebContainer, context: Context) {}
}

final class WebContainer: NSView {
    private let browser: Browser

    init(browser: Browser) {
        self.browser = browser
        super.init(frame: .zero)
        browser.webView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(browser.webView)
        NSLayoutConstraint.activate([
            browser.webView.leadingAnchor.constraint(equalTo: leadingAnchor),
            browser.webView.trailingAnchor.constraint(equalTo: trailingAnchor),
            browser.webView.topAnchor.constraint(equalTo: topAnchor),
            browser.webView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { return nil }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        browser.window = window
    }
}

struct TripCommands: Commands {
    @FocusedObject private var browser: Browser?

    var body: some Commands {
        CommandGroup(before: .toolbar) {
            Button("Reload Page") { browser?.reload() }
                .keyboardShortcut("r")
                .disabled(browser == nil)
            Divider()
            Button("Actual Size") { browser?.setZoom(1) }
                .keyboardShortcut("0")
                .disabled(browser == nil)
            Button("Zoom In") { browser?.changeZoom(by: 0.1) }
                .keyboardShortcut("=")
                .disabled(browser == nil)
            Button("Zoom Out") { browser?.changeZoom(by: -0.1) }
                .keyboardShortcut("-")
                .disabled(browser == nil)
            Divider()
        }
        CommandMenu("Go") {
            Button("Back") { browser?.webView.goBack() }
                .keyboardShortcut("[")
                .disabled(browser?.canGoBack != true)
            Button("Forward") { browser?.webView.goForward() }
                .keyboardShortcut("]")
                .disabled(browser?.canGoForward != true)
            Divider()
            Button("Home") { browser?.goHome() }
                .keyboardShortcut("h", modifiers: [.command, .shift])
                .disabled(browser == nil)
        }
    }
}
