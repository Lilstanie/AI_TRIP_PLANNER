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

    func makeNSView(context: Context) -> WKWebView { browser.webView }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
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
