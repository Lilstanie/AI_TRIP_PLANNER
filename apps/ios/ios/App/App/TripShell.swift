import UIKit
import Capacitor
import WebKit

struct ShellTab {
    let id: String
    let label: String
    let badge: Bool
}

final class TripBridgeViewController: CAPBridgeViewController, UITabBarDelegate {
    private let tabBar = UITabBar()
    private var tabIds: [String] = []
    private let shell = TripShellPlugin()

    var tabBarHeight: CGFloat {
        tabBar.isHidden ? 0 : tabBar.frame.height
    }

    override func capacitorDidLoad() {
        shell.controller = self
        bridge?.registerPluginInstance(shell)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        tabBar.delegate = self
        tabBar.isHidden = true
        tabBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(tabBar)
        NSLayoutConstraint.activate([
            tabBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tabBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    func apply(tabs: [ShellTab], selected: String?, hidden: Bool) {
        let ids = tabs.map(\.id)
        if ids != tabIds || zip(tabs, tabBar.items ?? []).contains(where: { $0.label != $1.title }) {
            tabIds = ids
            tabBar.setItems(
                tabs.enumerated().map { index, tab in
                    UITabBarItem(title: tab.label, image: UIImage(systemName: Self.symbol(for: tab.id)), tag: index)
                },
                animated: false
            )
        }
        for (index, tab) in tabs.enumerated() {
            tabBar.items?[index].badgeValue = tab.badge ? "" : nil
        }
        if let selected, let index = ids.firstIndex(of: selected) {
            tabBar.selectedItem = tabBar.items?[index]
        }
        tabBar.isHidden = hidden || tabs.isEmpty
        view.layoutIfNeeded()
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard tabIds.indices.contains(item.tag) else { return }
        let id = tabIds[item.tag]
        webView?.evaluateJavaScript("document.getElementById('phone-tab-\(id)')?.click()")
    }

    private static func symbol(for id: String) -> String {
        switch id {
        case "chat": return "bubble.left.and.bubble.right"
        case "map": return "map"
        case "trip": return "point.topleft.down.to.point.bottomright.curvepath"
        case "mine": return "person.crop.circle"
        default: return "circle"
        }
    }
}

@objc(TripShellPlugin)
public class TripShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TripShellPlugin"
    public let jsName = "TripShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setTabs", returnType: CAPPluginReturnPromise),
    ]
    weak var controller: TripBridgeViewController?

    @objc func setTabs(_ call: CAPPluginCall) {
        let tabs = (call.getArray("tabs", JSObject.self) ?? []).compactMap { tab -> ShellTab? in
            guard let id = tab["id"] as? String, let label = tab["label"] as? String else { return nil }
            return ShellTab(id: id, label: label, badge: tab["badge"] as? Bool ?? false)
        }
        let selected = call.getString("selected")
        let hidden = call.getBool("hidden") ?? false
        DispatchQueue.main.async { [weak self] in
            guard let controller = self?.controller else {
                call.reject("No shell")
                return
            }
            controller.apply(tabs: tabs, selected: selected, hidden: hidden)
            call.resolve(["height": controller.tabBarHeight])
        }
    }
}
