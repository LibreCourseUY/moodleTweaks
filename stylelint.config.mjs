export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "alpha-value-notation": null,
    "color-function-alias-notation": null,
    "color-function-notation": null,
    "no-descending-specificity": null,
    "selector-id-pattern": null,
    "selector-not-notation": null,
    "selector-class-pattern": "^[a-z][a-z0-9_-]*$",
  },
};