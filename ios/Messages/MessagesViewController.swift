import Messages
import SwiftUI

final class MessagesViewController: MSMessagesAppViewController {
    private var composer: UIHostingController<AnyView>?

    override func viewDidLoad() {
        super.viewDidLoad()

        let composer = UIHostingController(rootView: makeComposer(for: activeConversation))
        self.composer = composer
        addChild(composer)
        view.addSubview(composer.view)
        composer.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            composer.view.topAnchor.constraint(equalTo: view.topAnchor),
            composer.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            composer.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            composer.view.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        composer.didMove(toParent: self)
    }

    override func willBecomeActive(with conversation: MSConversation) {
        guard let composer else { return }
        composer.rootView = makeComposer(for: conversation)
    }

    private func makeComposer(for conversation: MSConversation?) -> AnyView {
        let participants = conversation?.remoteParticipantIdentifiers ?? []
        let chat = participants.count == 1 && presentationContext == .messages ? participants.first : nil
        return AnyView(GroupCallView(chat: chat) { [weak self] in
            guard let self, presentationContext == .messages, let conversation = activeConversation,
                  conversation.remoteParticipantIdentifiers == participants else {
                throw GroupCallFailure("Reopen Envoggle in your friend’s Messages conversation.")
            }
            try await conversation.sendText("Join me for Envoggle! Look for a FaceTime call from Chert.")
        }.id(chat))
    }
}
