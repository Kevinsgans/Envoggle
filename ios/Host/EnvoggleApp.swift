import SwiftUI

@main
struct EnvoggleApp: App {
    var body: some Scene {
        WindowGroup {
            VStack(alignment: .leading, spacing: 16) {
                Text("Envoggle").font(.largeTitle.bold())
                Text("Open a conversation in Messages and choose Envoggle from the app drawer to challenge a friend.")
            }
            .padding(28)
        }
    }
}
