import Messages
import UIKit

final class MessagesViewController: MSMessagesAppViewController {
    private let titleLabel = UILabel()
    private let details = UILabel()
    private let action = UIButton(type: .system)
    private var challengeCode: String?
    private var selectedSession: MSSession?
    private var task: Task<Void, Never>?

    private struct Challenge: Decodable {
        let code: String
        let accepted: Bool?
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        titleLabel.font = .preferredFont(forTextStyle: .title2)
        titleLabel.text = "Envoggle"
        details.font = .preferredFont(forTextStyle: .body)
        details.numberOfLines = 0
        action.configuration = .filled()
        action.addTarget(self, action: #selector(performAction), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [titleLabel, details, action])
        stack.axis = .vertical
        stack.spacing = 12
        stack.alignment = .leading
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
    }

    override func willBecomeActive(with conversation: MSConversation) {
        load(conversation.selectedMessage, in: conversation)
    }

    override func didSelect(_ message: MSMessage, conversation: MSConversation) {
        load(message, in: conversation)
    }

    private func load(_ message: MSMessage?, in conversation: MSConversation) {
        task?.cancel()
        action.isHidden = false
        selectedSession = message?.session
        let code: String? = message?.url.flatMap {
            guard $0.scheme == "envoggle", $0.host == "challenge",
                  let code = URLComponents(url: $0, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value,
                  code.range(of: #"^[0-9]{8}$"#, options: .regularExpression) != nil else { return nil }
            return code
        }
        challengeCode = code
        guard let code else {
            details.text = "Race a friend to find the rarest item on FaceTime."
            action.setTitle("Create Challenge", for: .normal)
            action.isEnabled = true
            return
        }
        let sentByMe = message?.senderParticipantIdentifier == conversation.localParticipantIdentifier
        details.text = "Checking challenge…"
        action.isEnabled = false
        task = Task {
            do {
                let challenge = try await request(code, method: "GET")
                guard !Task.isCancelled else { return }
                if challenge.accepted == true {
                    showAccepted(code)
                } else if sentByMe {
                    details.text = "Challenge \(code) · Waiting for your friend to accept."
                    action.isHidden = true
                } else {
                    details.text = "You've been challenged to a live Envoggle duel."
                    action.setTitle("Accept Challenge", for: .normal)
                    action.isEnabled = true
                }
            } catch {
                guard !Task.isCancelled else { return }
                details.text = error.localizedDescription
            }
        }
    }

    @objc private func performAction() {
        guard let conversation = activeConversation else { return }
        action.isEnabled = false
        let code = challengeCode
        let session = selectedSession ?? MSSession()
        task = Task {
            do {
                let challenge = try await request(code.map { "\($0)/accept" }, method: "POST")
                guard !Task.isCancelled else { return }
                let accepted = code != nil
                try await insertCard(challenge.code, accepted: accepted, session: session, into: conversation)
                guard !Task.isCancelled else { return }
                if accepted { showAccepted(challenge.code) }
                else {
                    details.text = "Tap Send to share your challenge."
                    action.isEnabled = true
                }
            } catch {
                guard !Task.isCancelled else { return }
                details.text = error.localizedDescription
                action.isEnabled = true
            }
        }
    }

    private func showAccepted(_ code: String) {
        details.text = "Challenge \(code) accepted. Start FaceTime, add the Envoggle referee, and tell it the code."
        action.isHidden = true
    }

    private func insertCard(_ code: String, accepted: Bool, session: MSSession, into conversation: MSConversation) async throws {
        let layout = MSMessageTemplateLayout()
        layout.caption = accepted ? "Envoggle · Challenge Accepted" : "Envoggle · 1v1 Challenge"
        layout.subcaption = accepted ? "FaceTime code \(code)" : "Tap to accept your friend's duel"
        let message = MSMessage(session: session)
        message.layout = layout
        message.summaryText = accepted ? "Envoggle challenge accepted" : "Envoggle 1v1 challenge"
        var url = URLComponents()
        url.scheme = "envoggle"
        url.host = "challenge"
        url.queryItems = [URLQueryItem(name: "code", value: code)]
        message.url = url.url
        try await conversation.insert(message)
    }

    private func request(_ path: String?, method: String) async throws -> Challenge {
        guard let server = Bundle.main.object(forInfoDictionaryKey: "EnvoggleServerURL") as? String,
              let base = URL(string: server), base.scheme == "https", base.host != nil else {
            throw ServiceError.missingServer
        }
        let endpoint = base.appendingPathComponent("api/duels")
        var request = URLRequest(url: path.map { endpoint.appendingPathComponent($0) } ?? endpoint)
        request.httpMethod = method
        request.timeoutInterval = 10
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw ServiceError.unavailable }
        if response.statusCode == 404 { throw ServiceError.expired }
        if response.statusCode == 409 { throw ServiceError.alreadyAccepted }
        guard (200..<300).contains(response.statusCode) else { throw ServiceError.unavailable }
        return try JSONDecoder().decode(Challenge.self, from: data)
    }
}

private enum ServiceError: LocalizedError {
    case missingServer, expired, alreadyAccepted, unavailable

    var errorDescription: String? {
        switch self {
        case .missingServer: "Set an HTTPS Envoggle server URL in the Xcode build settings."
        case .expired: "This challenge has expired."
        case .alreadyAccepted: "This challenge already has two players. Reopen the card to see its status."
        case .unavailable: "The Envoggle server is unavailable. Try again."
        }
    }
}
