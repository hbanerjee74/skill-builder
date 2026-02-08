/**
 * E2E mock for Tauri APIs. This file is loaded via vite plugin
 * when TAURI_E2E=true, replacing @tauri-apps/api/core.
 *
 * It provides mock responses for all invoke commands so the frontend
 * can render without the Rust backend.
 */

const defaultSettings = {
  anthropic_api_key: null,
  github_token: null,
  github_repo: null,
  workspace_path: null,
  auto_commit: false,
  auto_push: false,
};

const mockResponses: Record<string, unknown> = {
  get_settings: defaultSettings,
  save_settings: undefined,
  test_api_key: true,
  get_current_user: { login: "testuser", avatar_url: "", name: "Test User" },
  check_node: {
    available: true,
    version: "v20.11.0",
    meets_minimum: true,
    error: null,
  },
  list_skills: [],
  create_skill: undefined,
  delete_skill: undefined,
  list_github_repos: [
    {
      full_name: "testuser/my-skills",
      name: "my-skills",
      private: false,
      description: "Test repo",
      clone_url: "https://github.com/testuser/my-skills.git",
    },
  ],
  clone_repo: { path: "/tmp/test", created_readme: true, created_gitignore: true },
  commit_and_push: "Committed and pushed",
  parse_clarifications: {
    sections: [
      {
        heading: "Domain Concepts",
        questions: [
          {
            id: "Q1",
            title: "Primary focus",
            question: "What is the primary focus area for this skill?",
            choices: [
              { letter: "a", text: "Sales forecasting", rationale: "predict future revenue" },
              { letter: "b", text: "Pipeline management", rationale: "track deal progression" },
              { letter: "c", text: "Other (please specify)", rationale: "" },
            ],
            recommendation: "b — most actionable for day-to-day work",
            answer: null,
          },
        ],
      },
    ],
  },
  save_clarification_answers: undefined,
  save_raw_file: undefined,
};

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Allow tests to override via window
  const overrides = (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ as
    | Record<string, unknown>
    | undefined;
  if (overrides && cmd in overrides) {
    const val = overrides[cmd];
    if (val instanceof Error) throw val;
    return val as T;
  }

  if (cmd in mockResponses) {
    return mockResponses[cmd] as T;
  }

  console.warn(`[tauri-e2e-mock] Unhandled invoke: ${cmd}`, args);
  return undefined as T;
}
