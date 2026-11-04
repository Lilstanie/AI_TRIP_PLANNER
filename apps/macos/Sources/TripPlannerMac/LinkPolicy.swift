import Foundation

struct LinkPolicy: Decodable, Sendable {
    let appHosts: Set<String>
    let signInPaths: [String: [String]]

    static let bundled: LinkPolicy = {
        guard let url = Bundle.main.url(forResource: "link-policy", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let policy = try? JSONDecoder().decode(LinkPolicy.self, from: data)
        else { fatalError("link-policy.json is missing from the app bundle or is not valid") }
        return policy
    }()

    func opensInApp(_ url: URL) -> Bool {
        switch url.scheme {
        case "about", "blob", "data", "file":
            return true
        case "https":
            guard let host = url.host else { return false }
            if appHosts.contains(host) { return true }
            return signInPaths[host]?.contains { url.path.hasPrefix($0) } ?? false
        default:
            return false
        }
    }
}
