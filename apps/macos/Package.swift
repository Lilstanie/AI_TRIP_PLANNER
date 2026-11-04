// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "TripPlannerMac",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "TripPlannerMac", path: "Sources/TripPlannerMac")
    ]
)
