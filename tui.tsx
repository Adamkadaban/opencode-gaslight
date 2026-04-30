/** @jsxImportSource @opentui/solid */
import { createSignal, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes, RGBA } from "@opentui/core"
import type { TextareaRenderable } from "@opentui/core"
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"

type EditablePart = { type: "text" | "reasoning"; text: string; id: string }

function truncate(text: string, max: number): string {
  const oneline = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim()
  if (oneline.length <= max) return oneline
  return oneline.slice(0, max - 1) + "…"
}

// ── Tabbed editor: edit response + thinking in one dialog ────────────

function TabbedEditor(props: {
  api: TuiPluginApi
  responseText: string
  thinkingText: string
  onSave: (response: string, thinking: string) => void
  onCancel: () => void
}) {
  const [tab, setTab] = createSignal<"response" | "thinking">("response")
  const [savedResponse, setSavedResponse] = createSignal(props.responseText)
  const [savedThinking, setSavedThinking] = createSignal(props.thinkingText)
  let ref: TextareaRenderable | undefined

  const switchTab = () => {
    const val = ref?.plainText ?? ""
    if (tab() === "response") {
      setSavedResponse(val)
      setTab("thinking")
    } else {
      setSavedThinking(val)
      setTab("response")
    }
  }

  const save = () => {
    const val = ref?.plainText ?? ""
    const response = tab() === "response" ? val : savedResponse()
    const thinking = tab() === "thinking" ? val : savedThinking()
    props.onSave(response, thinking)
  }

  useKeyboard((evt) => {
    if (evt.name === "tab") {
      evt.preventDefault()
      evt.stopPropagation()
      switchTab()
      return
    }
    if (evt.name === "escape") {
      evt.preventDefault()
      props.onCancel()
      return
    }
  })

  const bright = RGBA.fromHex("#e0e0e0")
  const dim = RGBA.fromHex("#666666")
  const accent = RGBA.fromHex("#7aa2f7")

  return (
    <box flexDirection="column" width="100%" paddingLeft={2} paddingRight={2} paddingBottom={1}>
      {/* Title bar */}
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text fg={bright} attributes={TextAttributes.BOLD}>
          Edit Response
        </text>
        <text fg={dim}>esc to close</text>
      </box>

      {/* Tab bar */}
      <box flexDirection="row" gap={1} paddingBottom={1}>
        <text
          fg={tab() === "response" ? accent : dim}
          attributes={tab() === "response" ? TextAttributes.BOLD : 0}
        >
          {tab() === "response" ? "▸ Response" : "  Response"}
        </text>
        <text fg={dim}>│</text>
        <text
          fg={tab() === "thinking" ? accent : dim}
          attributes={tab() === "thinking" ? TextAttributes.BOLD : 0}
        >
          {tab() === "thinking" ? "▸ Thinking" : "  Thinking"}
        </text>
      </box>

      {/* Active textarea */}
      <Show when={tab() === "response"}>
        <textarea
          ref={(val: TextareaRenderable) => {
            ref = val
            val.focus()
          }}
          initialValue={savedResponse()}
          height={8}
          keyBindings={[{ name: "return", action: "submit" }]}
          onSubmit={save}
          placeholder="Response text"
          textColor={bright}
          focusedTextColor={bright}
          cursorColor={accent}
        />
      </Show>
      <Show when={tab() === "thinking"}>
        <textarea
          ref={(val: TextareaRenderable) => {
            ref = val
            val.focus()
          }}
          initialValue={savedThinking()}
          height={8}
          keyBindings={[{ name: "return", action: "submit" }]}
          onSubmit={save}
          placeholder="Thinking text"
          textColor={bright}
          focusedTextColor={bright}
          cursorColor={accent}
        />
      </Show>

      {/* Footer hints */}
      <box paddingTop={1}>
        <text fg={dim}>Tab: switch · Enter: save · Esc: cancel</text>
      </box>
    </box>
  )
}

// ── Plugin ───────────────────────────────────────────────────────────

const tui: TuiPlugin = async (api) => {
  api.command.register(() => [
    {
      title: "Gaslight",
      value: "plugin.gaslight",
      description: "Edit an assistant response in this session",
      category: "Session",
      slash: { name: "gaslight" },
      enabled: api.route.current.name === "session",
      onSelect: async () => {
        const route = api.route.current
        if (route.name !== "session") {
          api.ui.toast({ message: "No active session", variant: "error" })
          return
        }

        const sessionID = route.params.sessionID
        const messages = api.state.session.messages(sessionID)
        const assistantMsgs = messages.filter((m) => m.role === "assistant")

        if (assistantMsgs.length === 0) {
          api.ui.toast({ message: "No assistant messages found", variant: "error" })
          return
        }

        // Build options for the message picker
        const options = assistantMsgs
          .map((msg, idx) => {
            const parts = api.state.part(msg.id)
            const textParts = parts.filter((p) => p.type === "text") as EditablePart[]
            const reasoningParts = parts.filter(
              (p) => p.type === "reasoning",
            ) as EditablePart[]
            const hasText = textParts.some((p) => p.text.trim().length > 0)
            const hasReasoning = reasoningParts.some((p) => p.text.trim().length > 0)

            if (!hasText && !hasReasoning) return null

            const fullText = textParts.map((p) => p.text).join("")
            const badge = hasReasoning ? " [has thinking]" : ""
            const preview =
              fullText.length > 0
                ? truncate(fullText, 90) + badge
                : "(thinking only)" + badge

            return {
              title: `Response #${idx + 1}`,
              value: msg.id,
              description: preview,
            }
          })
          .filter((o): o is NonNullable<typeof o> => o !== null)
          .reverse()

        if (options.length === 0) {
          api.ui.toast({ message: "No editable content found", variant: "error" })
          return
        }

        const lastMsgId = assistantMsgs[assistantMsgs.length - 1].id

        // If only one message, skip the picker
        if (options.length === 1) {
          openEditor(sessionID, options[0].value)
          return
        }

        api.ui.dialog.setSize("large")
        api.ui.dialog.replace(
          () =>
            api.ui.DialogSelect({
              title: "Select response to edit",
              placeholder: "Search responses…",
              options,
              current: lastMsgId,
              onSelect: (option) => openEditor(sessionID, option.value as string),
            }),
          () => {},
        )
      },
    },
  ])

  // ── Open editor for a specific message ─────────────────────────────

  function openEditor(sessionID: string, messageID: string) {
    const messages = api.state.session.messages(sessionID)
    const message = messages.find((m) => m.id === messageID)
    if (!message) {
      api.ui.toast({ message: "Message not found", variant: "error" })
      return
    }

    const parts = api.state.part(message.id)
    const textParts = parts.filter((p) => p.type === "text") as EditablePart[]
    const reasoningParts = parts.filter((p) => p.type === "reasoning") as EditablePart[]
    const hasText = textParts.some((p) => p.text.trim().length > 0)
    const hasReasoning = reasoningParts.some((p) => p.text.trim().length > 0)

    if (!hasText && !hasReasoning) {
      api.ui.toast({ message: "No editable content", variant: "error" })
      return
    }

    // Both exist → tabbed editor
    if (hasText && hasReasoning) {
      const responseText = textParts.map((p) => p.text).join("")
      const thinkingText = reasoningParts.map((p) => p.text).join("")

      api.ui.dialog.setSize("large")
      api.ui.dialog.replace(
        () => (
          <TabbedEditor
            api={api}
            responseText={responseText}
            thinkingText={thinkingText}
            onSave={async (newResponse, newThinking) => {
              api.ui.dialog.clear()
              try {
                await saveParts(sessionID, messageID, textParts, newResponse)
                await saveParts(sessionID, messageID, reasoningParts, newThinking)
                api.ui.toast({ message: "Response updated", variant: "success" })
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to update"
                api.ui.toast({ message: msg, variant: "error" })
              }
            }}
            onCancel={() => api.ui.dialog.clear()}
          />
        ),
        () => {},
      )
      return
    }

    // Only one type → simple DialogPrompt
    const targetParts = hasText ? textParts : reasoningParts
    const label = hasText ? "Response" : "Thinking"
    const originalText = targetParts.map((p) => p.text).join("")

    api.ui.dialog.setSize("medium")
    api.ui.dialog.replace(
      () =>
        api.ui.DialogPrompt({
          title: `Edit ${label}`,
          value: originalText,
          placeholder: `Enter corrected ${label.toLowerCase()}`,
          onConfirm: async (newText: string) => {
            api.ui.dialog.clear()
            if (newText === originalText) {
              api.ui.toast({ message: "No changes made", variant: "info" })
              return
            }
            try {
              await saveParts(sessionID, messageID, targetParts, newText)
              api.ui.toast({ message: `${label} updated`, variant: "success" })
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Failed to update"
              api.ui.toast({ message: msg, variant: "error" })
            }
          },
          onCancel: () => api.ui.dialog.clear(),
        }),
      () => {},
    )
  }

  // ── Persist part updates ───────────────────────────────────────────

  async function saveParts(
    sessionID: string,
    messageID: string,
    parts: EditablePart[],
    newText: string,
  ) {
    const first = parts[0]
    await api.client.part.update({
      sessionID,
      messageID,
      partID: first.id,
      part: { ...first, text: newText },
    })
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      await api.client.part.update({
        sessionID,
        messageID,
        partID: part.id,
        part: { ...part, text: "" },
      })
    }
  }
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-gaslight",
  tui,
}

export default plugin
