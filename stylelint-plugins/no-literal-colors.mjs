import stylelint from 'stylelint'

const ruleName = 'pf/no-literal-colors'
const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (value) =>
    `Unexpected literal color "${value}". Use a CSS custom property (var(--…)) instead.`,
})

// Matches #rgb, #rgba, #rrggbb, #rrggbbaa
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/

// Matches color-producing functions (legacy + modern CSS Color 4/5).
// `color-mix` is intentionally NOT included — it composes colors via var().
const COLOR_FUNCTION_RE =
  /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(/i

const rule = (primary) => (root, result) => {
  if (primary !== true) return

  root.walkDecls((decl) => {
    // Custom property definitions (--foo: …) are the only place literal
    // colors are permitted — that's where the color tokens are declared.
    if (decl.prop.startsWith('--')) return

    const { value } = decl

    if (HEX_RE.test(value) || COLOR_FUNCTION_RE.test(value)) {
      stylelint.utils.report({
        message: messages.rejected(value),
        node: decl,
        result,
        ruleName,
      })
    }
  })
}

rule.ruleName = ruleName
rule.messages = messages
rule.meta = { url: '' }

export default stylelint.createPlugin(ruleName, rule)
