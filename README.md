# promptfoo-demo

- GitHub Actions workflow that executes Promptfoo evaluations automatically, caches previous responses, produces reports, and uploads those reports as build artifacts.

- OpenRouter with Promptfoo by storing OPENROUTER_API_KEY as a GitHub secret and changing the provider ID to openrouter:<model-id>. For the quality gate, add measurable assertions in promptfooconfig.yaml and run Promptfoo with --fail-on-error, which makes the GitHub job fail when an assertion does not pass.

``
your-project/
├── .github/
│   └── workflows/
│       └── promptfoo-eval.yml
├── prompts/
│   └── customer-support.txt
├── promptfooconfig.yaml
├── package.json
└── README.md``
