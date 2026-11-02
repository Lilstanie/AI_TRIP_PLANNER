import UIKit
import MapKit
import Capacitor
import WebKit

final class PassthroughWebView: WKWebView {
    weak var mapView: MKMapView?
    var mapFrame: CGRect = .null
    var occluders: [CGRect] = []

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let mapView, !mapView.isHidden, mapFrame.contains(point),
              !occluders.contains(where: { $0.contains(point) }) else {
            return super.hitTest(point, with: event)
        }
        for view in subviews.reversed() where view !== scrollView && view !== mapView {
            if let hit = view.hitTest(convert(point, to: view), with: event) { return hit }
        }
        return mapView.hitTest(convert(point, to: mapView), with: event)
    }
}

final class StopAnnotation: NSObject, MKAnnotation {
    let id: String
    let coordinate: CLLocationCoordinate2D
    let title: String?
    let kind: String
    let glyph: String
    let color: UIColor
    let mode: String
    let clickable: Bool
    let zIndex: Int

    init(id: String, options: [String: Any]) {
        self.id = id
        coordinate = CLLocationCoordinate2D(
            latitude: (options["lat"] as? NSNumber)?.doubleValue ?? 0,
            longitude: (options["lng"] as? NSNumber)?.doubleValue ?? 0
        )
        let name = options["title"] as? String ?? ""
        title = name.isEmpty ? nil : name
        kind = options["kind"] as? String ?? "stop"
        glyph = options["glyph"] as? String ?? ""
        color = UIColor(tripHex: options["color"] as? String) ?? .systemBlue
        mode = options["mode"] as? String ?? ""
        clickable = options["clickable"] as? Bool ?? false
        zIndex = (options["zIndex"] as? NSNumber)?.intValue ?? 0
    }

    func same(as other: StopAnnotation) -> Bool {
        coordinate.latitude == other.coordinate.latitude && coordinate.longitude == other.coordinate.longitude
            && title == other.title && kind == other.kind && glyph == other.glyph && color == other.color
            && mode == other.mode && clickable == other.clickable && zIndex == other.zIndex
    }
}

final class TripLine: MKPolyline {
    var id = ""
    var color: UIColor = .systemBlue
    var width: CGFloat = 4
    var zIndex = 0
}

final class TripMapController: NSObject, MKMapViewDelegate {
    let map = MKMapView()
    weak var plugin: TripMapPlugin?
    weak var webView: PassthroughWebView?
    private var markers: [String: StopAnnotation] = [:]
    private var selected: Set<String> = []
    private var lines: [String: TripLine] = [:]
    private var pendingCamera: (CLLocationCoordinate2D, Double)?
    private var pendingFit: (() -> Void)?
    private var inset = UIEdgeInsets.zero
    private var changing = false
    private var applying = false

    init(webView: PassthroughWebView) {
        self.webView = webView
        super.init()
        map.delegate = self
        map.isHidden = true
        map.showsCompass = false
        map.showsScale = false
        map.pointOfInterestFilter = .excludingAll
        map.insetsLayoutMarginsFromSafeArea = false
        webView.insertSubview(map, at: 0)
        webView.mapView = map
    }

    func create(center: CLLocationCoordinate2D, zoom: Double, dark: Bool) {
        clear()
        style(dark: dark, type: nil)
        pendingCamera = (center, zoom)
        if map.bounds.width > 0 { applyPendingCamera() }
    }

    func destroy() {
        clear()
        hide()
    }

    private func clear() {
        map.removeAnnotations(map.annotations)
        map.removeOverlays(map.overlays)
        markers.removeAll()
        selected.removeAll()
        lines.removeAll()
        pendingCamera = nil
        pendingFit = nil
    }

    private func hide() {
        map.isHidden = true
        webView?.mapFrame = .null
        webView?.occluders = []
        webView?.isOpaque = true
        webView?.backgroundColor = .systemBackground
        webView?.scrollView.backgroundColor = .systemBackground
    }

    func layout(visible: Bool, frame: CGRect, inset: UIEdgeInsets, occluders: [CGRect]) {
        guard visible, frame.width > 0, frame.height > 0, let webView else {
            hide()
            return
        }
        self.inset = inset
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        map.frame = frame
        map.layoutMargins = inset
        map.isHidden = false
        webView.mapFrame = frame
        webView.occluders = occluders
        if pendingCamera != nil { applyPendingCamera() }
        if let fit = pendingFit {
            pendingFit = nil
            fit()
        }
    }

    private func applyPendingCamera() {
        guard let pending = pendingCamera else { return }
        pendingCamera = nil
        apply { map.setVisibleMapRect(rect(center: pending.0, zoom: pending.1), animated: false) }
    }

    func camera(lat: Double?, lng: Double?, zoom: Double?, animated: Bool) {
        let current = map.region.center
        let center = CLLocationCoordinate2D(latitude: lat ?? current.latitude, longitude: lng ?? current.longitude)
        let level = zoom ?? currentZoom
        if map.bounds.width == 0 {
            pendingFit = nil
            pendingCamera = (center, level)
            return
        }
        apply { map.setVisibleMapRect(rect(center: center, zoom: level), animated: animated) }
    }

    func fit(north: Double, south: Double, east: Double, west: Double, padding: CGFloat, maxZoom: Double?) {
        guard north >= south else { return }
        guard map.bounds.width > 0 else {
            pendingCamera = nil
            pendingFit = { [weak self] in
                self?.fit(north: north, south: south, east: east, west: west, padding: padding, maxZoom: maxZoom)
            }
            return
        }
        let a = MKMapPoint(CLLocationCoordinate2D(latitude: north, longitude: west))
        let b = MKMapPoint(CLLocationCoordinate2D(latitude: south, longitude: east))
        var target = MKMapRect(
            x: min(a.x, b.x), y: min(a.y, b.y), width: max(abs(a.x - b.x), 1), height: max(abs(a.y - b.y), 1)
        )
        let edges = UIEdgeInsets(
            top: padding + inset.top, left: padding + inset.left,
            bottom: padding + inset.bottom, right: padding + inset.right
        )
        let stops = MKMapPoint(x: target.midX, y: target.midY)
        target = map.mapRectThatFits(target, edgePadding: edges)
        if let maxZoom, zoom(of: target) > maxZoom {
            let scale = pow(2, 20 - maxZoom)
            let width = Double(map.bounds.width) * scale
            let height = Double(map.bounds.height) * scale
            let x = stops.x - Double(edges.left - edges.right) / 2 * scale
            let y = stops.y - Double(edges.top - edges.bottom) / 2 * scale
            target = MKMapRect(x: x - width / 2, y: y - height / 2, width: width, height: height)
        }
        apply { map.setVisibleMapRect(target, animated: false) }
    }

    func style(dark: Bool?, type: String?) {
        if let dark { map.overrideUserInterfaceStyle = dark ? .dark : .light }
        if let type { map.mapType = type == "hybrid" ? .hybrid : .standard }
    }

    func setMarker(_ options: [String: Any]) {
        guard let id = options["id"] as? String else { return }
        let next = StopAnnotation(id: id, options: options)
        let wantsSelection = options["selected"] as? Bool ?? false
        if let current = markers[id], current.same(as: next) {
            select(current, wantsSelection)
            return
        }
        applying = true
        if let current = markers[id] { map.removeAnnotation(current) }
        markers[id] = next
        map.addAnnotation(next)
        applying = false
        select(next, wantsSelection)
    }

    func removeMarker(id: String) {
        guard let current = markers.removeValue(forKey: id) else { return }
        selected.remove(id)
        applying = true
        map.removeAnnotation(current)
        applying = false
    }

    private func select(_ annotation: StopAnnotation, _ wanted: Bool) {
        let isSelected = map.selectedAnnotations.contains { $0 === annotation }
        guard wanted != isSelected else { return }
        applying = true
        if wanted {
            selected.insert(annotation.id)
            map.selectAnnotation(annotation, animated: true)
        } else {
            selected.remove(annotation.id)
            map.deselectAnnotation(annotation, animated: true)
        }
        applying = false
    }

    func setLine(_ options: [String: Any]) {
        guard let id = options["id"] as? String else { return }
        removeLine(id: id)
        let values = (options["path"] as? [Any] ?? []).compactMap { ($0 as? NSNumber)?.doubleValue }
        var coordinates = stride(from: 0, to: values.count - 1, by: 2).map {
            CLLocationCoordinate2D(latitude: values[$0], longitude: values[$0 + 1])
        }
        guard coordinates.count > 1 else { return }
        let line = TripLine(coordinates: &coordinates, count: coordinates.count)
        line.id = id
        line.color = UIColor(tripHex: options["color"] as? String) ?? .systemBlue
        line.width = CGFloat((options["width"] as? NSNumber)?.doubleValue ?? 4)
        line.zIndex = (options["zIndex"] as? NSNumber)?.intValue ?? 0
        let below = map.overlays(in: .aboveRoads).filter { (($0 as? TripLine)?.zIndex ?? 0) <= line.zIndex }.count
        map.insertOverlay(line, at: below, level: .aboveRoads)
        lines[id] = line
    }

    func removeLine(id: String) {
        guard let line = lines.removeValue(forKey: id) else { return }
        map.removeOverlay(line)
    }

    private var currentZoom: Double { zoom(of: map.visibleMapRect) }

    private func zoom(of rect: MKMapRect) -> Double {
        20 - log2(rect.size.width / Double(max(map.bounds.width, 1)))
    }

    private func rect(center: CLLocationCoordinate2D, zoom: Double) -> MKMapRect {
        let scale = pow(2, 20 - zoom)
        let width = Double(map.bounds.width) * scale
        let height = Double(map.bounds.height) * scale
        let point = MKMapPoint(center)
        return MKMapRect(x: point.x - width / 2, y: point.y - height / 2, width: width, height: height)
    }

    private func apply(_ change: () -> Void) {
        changing = false
        change()
        if !changing { report() }
    }

    private func report() {
        let region = map.region
        plugin?.notifyListeners("region", data: [
            "lat": region.center.latitude,
            "lng": region.center.longitude,
            "zoom": currentZoom,
            "north": region.center.latitude + region.span.latitudeDelta / 2,
            "south": region.center.latitude - region.span.latitudeDelta / 2,
            "east": region.center.longitude + region.span.longitudeDelta / 2,
            "west": region.center.longitude - region.span.longitudeDelta / 2,
        ])
    }

    func mapView(_ mapView: MKMapView, regionWillChangeAnimated animated: Bool) {
        changing = true
        let gesture = mapView.subviews.first?.gestureRecognizers?.contains {
            $0.state == .began || $0.state == .changed
        } ?? false
        plugin?.notifyListeners("regionStart", data: ["gesture": gesture])
    }

    func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
        report()
    }

    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        guard let stop = annotation as? StopAnnotation else { return nil }
        switch stop.kind {
        case "mode":
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: "mode")
                ?? MKAnnotationView(annotation: stop, reuseIdentifier: "mode")
            view.annotation = stop
            view.image = Self.badge(symbol: Self.symbol(for: stop.mode), tint: .label, fill: .systemBackground, size: 24)
            view.displayPriority = .defaultLow
            view.collisionMode = .circle
            view.isEnabled = false
            view.zPriority = .min
            return view
        case "user":
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: "user")
                ?? MKAnnotationView(annotation: stop, reuseIdentifier: "user")
            view.annotation = stop
            view.image = Self.dot()
            view.displayPriority = .required
            view.isEnabled = false
            view.zPriority = .max
            return view
        default:
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: "stop") as? MKMarkerAnnotationView
                ?? MKMarkerAnnotationView(annotation: stop, reuseIdentifier: "stop")
            view.annotation = stop
            view.glyphText = stop.glyph
            view.markerTintColor = stop.color
            view.titleVisibility = .adaptive
            view.subtitleVisibility = .hidden
            view.displayPriority = .required
            view.canShowCallout = false
            view.isEnabled = stop.clickable
            view.zPriority = MKAnnotationViewZPriority(rawValue: 500 + Float(stop.zIndex))
            return view
        }
    }

    func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
        guard !applying, let stop = view.annotation as? StopAnnotation else { return }
        selected.insert(stop.id)
        plugin?.notifyListeners("markerTap", data: ["id": stop.id])
    }

    func mapView(_ mapView: MKMapView, didDeselect view: MKAnnotationView) {
        guard !applying, let stop = view.annotation as? StopAnnotation else { return }
        selected.remove(stop.id)
        plugin?.notifyListeners("mapTap", data: [:])
    }

    func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
        guard let line = overlay as? TripLine else { return MKOverlayRenderer(overlay: overlay) }
        let renderer = MKPolylineRenderer(polyline: line)
        renderer.strokeColor = line.color
        renderer.lineWidth = line.width
        renderer.lineCap = .round
        renderer.lineJoin = .round
        return renderer
    }

    private static func symbol(for mode: String) -> String {
        switch mode {
        case "WALK": return "figure.walk"
        case "TRANSIT": return "tram.fill"
        case "DRIVE": return "car.fill"
        case "BICYCLE": return "bicycle"
        default: return "arrow.right"
        }
    }

    private static func badge(symbol: String, tint: UIColor, fill: UIColor, size: CGFloat) -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: size, height: size)).image { context in
            let bounds = CGRect(x: 0, y: 0, width: size, height: size)
            fill.setFill()
            context.cgContext.setShadow(offset: CGSize(width: 0, height: 1), blur: 3, color: UIColor.black.withAlphaComponent(0.25).cgColor)
            UIBezierPath(ovalIn: bounds.insetBy(dx: 1.5, dy: 1.5)).fill()
            context.cgContext.setShadow(offset: .zero, blur: 0, color: nil)
            let config = UIImage.SymbolConfiguration(pointSize: size * 0.46, weight: .semibold)
            if let image = UIImage(systemName: symbol, withConfiguration: config)?.withTintColor(tint, renderingMode: .alwaysOriginal) {
                image.draw(in: CGRect(
                    x: (size - image.size.width) / 2, y: (size - image.size.height) / 2,
                    width: image.size.width, height: image.size.height
                ))
            }
        }
    }

    private static func dot() -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: 22, height: 22)).image { context in
            context.cgContext.setShadow(offset: CGSize(width: 0, height: 1), blur: 3, color: UIColor.black.withAlphaComponent(0.3).cgColor)
            UIColor.white.setFill()
            UIBezierPath(ovalIn: CGRect(x: 2, y: 2, width: 18, height: 18)).fill()
            context.cgContext.setShadow(offset: .zero, blur: 0, color: nil)
            UIColor.systemBlue.setFill()
            UIBezierPath(ovalIn: CGRect(x: 5, y: 5, width: 12, height: 12)).fill()
        }
    }
}

extension UIColor {
    convenience init?(tripHex: String?) {
        guard var hex = tripHex?.trimmingCharacters(in: .whitespaces), hex.hasPrefix("#") else { return nil }
        hex.removeFirst()
        if hex.count == 6 { hex += "ff" }
        guard hex.count == 8, let value = UInt64(hex, radix: 16) else { return nil }
        self.init(
            red: CGFloat((value >> 24) & 0xff) / 255,
            green: CGFloat((value >> 16) & 0xff) / 255,
            blue: CGFloat((value >> 8) & 0xff) / 255,
            alpha: CGFloat(value & 0xff) / 255
        )
    }
}

@objc(TripMapPlugin)
public class TripMapPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TripMapPlugin"
    public let jsName = "TripMap"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "create", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "destroy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "layout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "camera", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fit", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "style", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMarker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeMarker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLine", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeLine", returnType: CAPPluginReturnPromise),
    ]
    var controller: TripMapController?

    private func run(_ call: CAPPluginCall, _ work: @escaping (TripMapController, [String: Any]) -> Void) {
        let options = call.options as? [String: Any] ?? [:]
        DispatchQueue.main.async { [weak self] in
            guard let controller = self?.controller else {
                call.reject("No map")
                return
            }
            work(controller, options)
            call.resolve()
        }
    }

    private static func number(_ options: [String: Any], _ key: String) -> Double? {
        (options[key] as? NSNumber)?.doubleValue
    }

    private static func rect(_ value: Any?) -> CGRect {
        let o = value as? [String: Any] ?? [:]
        return CGRect(
            x: number(o, "x") ?? 0, y: number(o, "y") ?? 0,
            width: number(o, "width") ?? 0, height: number(o, "height") ?? 0
        )
    }

    @objc func create(_ call: CAPPluginCall) {
        run(call) { map, o in
            map.create(
                center: CLLocationCoordinate2D(latitude: Self.number(o, "lat") ?? 0, longitude: Self.number(o, "lng") ?? 0),
                zoom: Self.number(o, "zoom") ?? 2,
                dark: o["dark"] as? Bool ?? false
            )
        }
    }

    @objc func destroy(_ call: CAPPluginCall) {
        run(call) { map, _ in map.destroy() }
    }

    @objc func layout(_ call: CAPPluginCall) {
        run(call) { map, o in
            let inset = o["inset"] as? [String: Any] ?? [:]
            map.layout(
                visible: o["visible"] as? Bool ?? false,
                frame: Self.rect(o["frame"]),
                inset: UIEdgeInsets(
                    top: Self.number(inset, "top") ?? 0, left: Self.number(inset, "left") ?? 0,
                    bottom: Self.number(inset, "bottom") ?? 0, right: Self.number(inset, "right") ?? 0
                ),
                occluders: (o["occluders"] as? [Any] ?? []).map { Self.rect($0) }
            )
        }
    }

    @objc func camera(_ call: CAPPluginCall) {
        run(call) { map, o in
            map.camera(
                lat: Self.number(o, "lat"), lng: Self.number(o, "lng"), zoom: Self.number(o, "zoom"),
                animated: o["animated"] as? Bool ?? false
            )
        }
    }

    @objc func fit(_ call: CAPPluginCall) {
        run(call) { map, o in
            map.fit(
                north: Self.number(o, "north") ?? 0, south: Self.number(o, "south") ?? 0,
                east: Self.number(o, "east") ?? 0, west: Self.number(o, "west") ?? 0,
                padding: CGFloat(Self.number(o, "padding") ?? 72), maxZoom: Self.number(o, "maxZoom")
            )
        }
    }

    @objc func style(_ call: CAPPluginCall) {
        run(call) { map, o in map.style(dark: o["dark"] as? Bool, type: o["type"] as? String) }
    }

    @objc func setMarker(_ call: CAPPluginCall) {
        run(call) { map, o in map.setMarker(o) }
    }

    @objc func removeMarker(_ call: CAPPluginCall) {
        run(call) { map, o in if let id = o["id"] as? String { map.removeMarker(id: id) } }
    }

    @objc func setLine(_ call: CAPPluginCall) {
        run(call) { map, o in map.setLine(o) }
    }

    @objc func removeLine(_ call: CAPPluginCall) {
        run(call) { map, o in if let id = o["id"] as? String { map.removeLine(id: id) } }
    }
}
