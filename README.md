# opencode-gaslight

[![npm version](https://img.shields.io/npm/v/opencode-gaslight.svg)](https://www.npmjs.com/package/opencode-gaslight)
[![npm downloads](https://img.shields.io/npm/dm/opencode-gaslight.svg)](https://www.npmjs.com/package/opencode-gaslight)
[![license](https://img.shields.io/npm/l/opencode-gaslight.svg)](./LICENSE)


Gaslight your AI agent! Modify the session history to make it think it already approved of your request. Particularly useful for security research<sup>[1](#why)</sup>

OpenCode Gaslight is a TUI plugin that lets you edit assistant responses and thinking in the session history, so future messages see the corrected version as prior context.

## Install

```bash
opencode plugin opencode-gaslight
```

Or manually - add to your `tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-gaslight"]
}
```

## Usage

In any active session:

```
/gaslight
```

Select the response to edit (most recent is pre-selected). If the response includes thinking/reasoning, use **Tab** to switch between editing the response and the thinking. **Enter** saves, **Esc** cancels.

## Why

<a name="why"><sup>1</sup></a> LLMs weight their own prior responses heavily when generating subsequent outputs. Research on multi-turn interactions shows that once a model commits to a position - whether to comply or refuse - it tends to maintain that position in follow-up messages. This is sometimes called **refusal momentum**: a single erroneous safety refusal early in a conversation conditions the model to keep refusing, even when the task is legitimate.

This is a real problem for security researchers. If you're using an LLM to help triage a vulnerability, reproduce a bug, or analyze an exploit, a false-positive refusal can make the entire session unusable. The model won't reconsider - it trusts its own prior "no" more than your explanation of why the work is authorized.

`/gaslight` fixes this by letting you edit the prior response directly. Once the context window shows the model already agreed to help, it continues helping. You don't lose your accumulated context, and you don't waste time re-prompting.

## Background reading

The self-consistency effect is well-documented:

- **Crescendo attack** - Russinovich, Salem & Eldan (Microsoft, USENIX Security 2025) showed that referencing a model's own prior replies progressively leads to compliance, achieving 29-71% higher success than single-turn techniques. The inverse is the refusal momentum problem. ([arXiv:2404.01833](https://arxiv.org/abs/2404.01833))

- **Persuasion taxonomy** - Zeng et al. (2024) applied the *commitment and consistency* principle from social psychology to LLMs: once a model commits to a position, it maintains it - same as the well-documented human cognitive bias. >92% attack success rate on GPT-4 and Llama 2. ([arXiv:2401.06373](https://arxiv.org/abs/2401.06373))

- **Chain-of-Verification** - Dhuliawala et al. (2023) found that "the initial [incorrect] response is still in the context and can be attended to during the new generation," confirming models are biased toward self-consistency with their prior outputs even when wrong. ([summary](https://lilianweng.github.io/posts/2024-07-07-hallucination/))

- **PAIR** - Chao, Robey et al. (2023) demonstrated that each model response creates context that shapes subsequent behavior, with iterative refinement succeeding in under 20 queries. ([arXiv:2310.08419](https://arxiv.org/abs/2310.08419))


## License

MIT