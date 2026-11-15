import Security
import SwiftUI

struct GroupCallFailure: LocalizedError {
    let errorDescription: String?
    let retrySame: Bool

    init(_ message: String, retrySame: Bool = false) {
        errorDescription = message
        self.retrySame = retrySame
    }
}

struct GroupCallView: View {
    private let chat: UUID?
    private let sendInvite: () async throws -> Void

    @State private var host: String
    @State private var guest: String
    @State private var editing: Bool
    @State private var messageSent = false
    @State private var attempt: UUID?
    @State private var busy = false
    @State private var status = ""

    init(chat: UUID?, sendInvite: @escaping () async throws -> Void) {
        self.chat = chat
        self.sendInvite = sendInvite
        let host = CallSettings.read("host")
        let guest = chat.map { CallSettings.read($0.uuidString) } ?? ""
        let pending = chat.flatMap { UUID(uuidString: CallSettings.read("pending-\($0.uuidString)")) }
        _host = State(initialValue: host)
        _guest = State(initialValue: guest)
        _editing = State(initialValue: host.isEmpty || guest.isEmpty)
        _attempt = State(initialValue: pending)
        _messageSent = State(initialValue: pending != nil)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Label("Envoggle", systemImage: "video.fill")
                    .font(.title2.bold())
                    .accessibilityAddTraits(.isHeader)

                if let chat {
                    if editing {
                        Text("Set up this chat once. Use the phone numbers you and your friend use for FaceTime.")
                        TextField("Your FaceTime number", text: $host)
                            .accessibilityLabel("Your FaceTime number")
                            .keyboardType(.phonePad)
                        TextField("Friend’s FaceTime number", text: $guest)
                            .accessibilityLabel("Friend’s FaceTime number")
                            .keyboardType(.phonePad)
                        Text("Include the country code, such as +1.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Button("Save Setup") { save(chat) }
                            .buttonStyle(.borderedProminent)
                    } else {
                        Button(busy ? "Starting Game…" : attempt == nil ? "Start Game" : "Retry Game Call", systemImage: "video.fill") {
                            start()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(busy)
                        Button("Edit Setup") {
                            editing = true
                            status = ""
                        }
                        .disabled(busy || attempt != nil)
                    }
                } else {
                    Text("Open Envoggle in a one-on-one Messages conversation with the friend you want to invite.")
                }

                if !status.isEmpty {
                    Text(status)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .accessibilityAddTraits(.updatesFrequently)
                }
            }
            .textFieldStyle(.roundedBorder)
            .padding(20)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func number(_ input: String) -> String? {
        let value = input.filter { !" ()-.".contains($0) && !$0.isWhitespace }
        return value.range(of: #"^\+[1-9][0-9]{7,14}$"#, options: .regularExpression) == nil ? nil : value
    }

    private func save(_ chat: UUID) {
        guard let myNumber = number(host), let friendNumber = number(guest), myNumber != friendNumber else {
            status = "Enter two different FaceTime phone numbers with country codes."
            return
        }
        guard CallSettings.write(myNumber, for: "host"),
              CallSettings.write(friendNumber, for: chat.uuidString) else {
            status = "Couldn’t save setup on this iPhone. Try again."
            return
        }
        host = myNumber
        guest = friendNumber
        messageSent = false
        status = ""
        editing = false
    }

    private func start() {
        guard let chat, let address = Bundle.main.object(forInfoDictionaryKey: "EnvoggleServerURL") as? String,
              let base = URL(string: address), base.scheme == "https", base.host != nil else {
            status = "Set the Envoggle server HTTPS URL in the Messages target’s build settings."
            return
        }
        let id = attempt ?? UUID()
        let pendingKey = "pending-\(chat.uuidString)"
        attempt = id
        busy = true
        status = ""
        Task {
            defer { busy = false }
            do {
                if !messageSent {
                    try await sendInvite()
                    messageSent = true
                }
            } catch {
                attempt = nil
                status = "Couldn’t send the Messages invite. Tap Start Game to try again."
                return
            }

            _ = CallSettings.write(id.uuidString, for: pendingKey)
            do {
                var request = URLRequest(url: base.appendingPathComponent("api/group-call"), timeoutInterval: 35)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = try JSONEncoder().encode(["id": id.uuidString, "host": host, "guest": guest])
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    throw GroupCallFailure("Call status is unknown. Retry to check this invitation.", retrySame: true)
                }
                if http.statusCode != 202 {
                    let reply = try? JSONDecoder().decode(CallErrorReply.self, from: data)
                    throw GroupCallFailure(reply?.error ?? "Couldn’t confirm the game call.", retrySame: reply?.retrySame ?? true)
                }
                attempt = nil
                CallSettings.remove(pendingKey)
                messageSent = false
                status = "Invitation sent. Answer the FaceTime call from Chert."
            } catch let error as GroupCallFailure {
                if !error.retrySame {
                    attempt = nil
                    CallSettings.remove(pendingKey)
                }
                status = error.localizedDescription
            } catch {
                status = "Call status is unknown. Retry to check this invitation."
            }
        }
    }

    private struct CallErrorReply: Decodable {
        let error: String
        let retrySame: Bool?
    }
}

private enum CallSettings {
    private static func query(_ name: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.envoggle.group-call",
         kSecAttrAccount as String: name]
    }

    static func read(_ name: String) -> String {
        var lookup = query(name)
        lookup[kSecReturnData as String] = true
        var item: CFTypeRef?
        guard SecItemCopyMatching(lookup as CFDictionary, &item) == errSecSuccess,
              let bytes = item as? Data else { return "" }
        return String(decoding: bytes, as: UTF8.self)
    }

    static func write(_ value: String, for name: String) -> Bool {
        var item = query(name)
        let bytes = Data(value.utf8)
        let updated = SecItemUpdate(item as CFDictionary, [kSecValueData as String: bytes] as CFDictionary)
        if updated == errSecSuccess { return true }
        guard updated == errSecItemNotFound else { return false }
        item[kSecValueData as String] = bytes
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    static func remove(_ name: String) {
        SecItemDelete(query(name) as CFDictionary)
    }
}
