import SwiftUI

@main
struct EnvoggleApp: App {
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                VStack(alignment: .leading, spacing: 16) {
                    Label("Play in Messages", systemImage: "message")
                        .font(.title2.bold())
                    Text("Open a conversation with your friend, tap +, and choose Envoggle. Set up the chat once, then tap Start Game to send the invite and start FaceTime with Chert.")
                }
                .padding(20)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .navigationTitle("Envoggle")
            }
        }
    }
}
