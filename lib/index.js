import { defineTool } from "@deepseek-ai/dsh-tools";
import { snapshotJsonValue } from "@deepseek-ai/dsh-util-values";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FileSystemSkillProvider } from "@deepseek-ai/dsh-skill-filesystem";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
//#region src/ids.ts
/** Startup line the plugin prints once it has loaded. */
const BOOT_MARKER = "[pstack-dsh] loaded";
/** Cordis plugin / Loader row id. */
const PLUGIN_ID = "pstack-dsh";
/** Bundled skill provider name on `ctx.skills`. */
const SKILL_PROVIDER_NAME = "pstack-dsh";
/** Overlay file under `$DSH_HOME`. */
const OVERLAY_FILENAME = "pstack-dsh.json";
/** DSH-owned OAuth store from dsh-oauth-login. Never ~/.pi / ~/.codex / ~/.claude / grok CLI. */
const OAUTH_AUTH_FILENAME = ".dsh-oauth-auth.json";
const OAUTH_AUTH_LEGACY_FILENAME = ".pi-login-auth.json";
/** Antigravity OAuth store from dsh-antigravity-oauth. */
const ANTIGRAVITY_AUTH_FILENAME = ".dsh-antigravity-oauth.json";
/** Official DeepSeek adapter. `packages/llm/llm-deepseek/src/index.ts` `PROVIDER`, `DEFAULT_API_KEY_ENV`. */
const DEEPSEEK_API_KEY_ENV = "DEEPSEEK_API_KEY";
/** Model-facing tool names this plugin registers. */
const TOOL_CATALOG = "pstack_catalog";
const TOOL_SPAWN = "pstack_spawn";
const TOOL_OVERLAY_READ = "pstack_overlay_read";
const TOOL_OVERLAY_WRITE = "pstack_overlay_write";
/** Same-origin Web routes. Pattern: dsh-oauth-login `src/auth-routes.ts`. */
const SETTINGS_SNAPSHOT_PATH = "/plugins/pstack-dsh/settings";
//#endregion
//#region src/plugin-config.ts
const Config = { "~standard": {
	version: 1,
	vendor: "pstack-dsh",
	validate(value) {
		if (value === void 0 || value === null) return { value: { spawnProvider: "spawn" } };
		if (typeof value !== "object" || Array.isArray(value)) return { issues: [{ message: "config must be an object" }] };
		const spawnProvider = value.spawnProvider;
		if (spawnProvider !== void 0 && (typeof spawnProvider !== "string" || spawnProvider.length === 0)) return { issues: [{ message: "spawnProvider must be a non-empty string" }] };
		return { value: { spawnProvider: spawnProvider ?? "spawn" } };
	}
} };
//#endregion
//#region src/presets.ts
const POTETO_PRESET_ID = "pstack-poteto";
const COMMENT_SICKO_PRESET_ID = "pstack-comment-sicko";
/** Tool rows the Web host no longer mounts globally. An independent child preset does not inherit the parent preset, so these rows have to live here. */
function developmentPlugins() {
	return [
		{
			id: "agent-instructions",
			name: "@deepseek-ai/dsh-agent-instructions",
			config: { maxBytes: 65536 }
		},
		{
			id: "tool-bash",
			name: "@deepseek-ai/dsh-tool-bash"
		},
		{
			id: "tool-fs",
			name: "@deepseek-ai/dsh-tool-fs",
			config: { applyPatch: false }
		},
		{
			id: "tool-fs-search",
			name: "@deepseek-ai/dsh-tool-fs-search",
			config: { sampleOverCapGlobResults: false }
		},
		{
			id: "skill-filesystem",
			name: "@deepseek-ai/dsh-skill-filesystem"
		},
		{
			id: "tool-skill",
			name: "@deepseek-ai/dsh-tool-skill"
		}
	];
}
function rolePresetPlugins(restrictWrites) {
	return [...developmentPlugins(), {
		id: "pstack-role",
		name: presetPluginUrl(),
		config: { restrictWrites }
	}];
}
function presetForRole(role) {
	if (role === "comment-sicko") return {
		id: COMMENT_SICKO_PRESET_ID,
		restrictsWrites: true
	};
	return {
		id: POTETO_PRESET_ID,
		restrictsWrites: false
	};
}
function presetPluginUrl() {
	return new URL("../presets/role.mjs", import.meta.url).href;
}
//#endregion
//#region src/skills-provider.ts
/** Bundled `skills/` beside `src/` and `lib/`. */
function defaultSkillsRoot() {
	return join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
}
/**
* Bundled pstack skills through the official filesystem provider. It parses
* frontmatter as YAML, watches the root and invalidates through `control`, and
* disposes its watchers when `control.signal` aborts. Only this root is mounted:
* project and user skill roots stay with DSH's own `filesystem` provider.
*/
function createSkillProvider(ctx, control, root = defaultSkillsRoot()) {
	return new FileSystemSkillProvider(ctx, control, {
		providerName: SKILL_PROVIDER_NAME,
		includeDefaultRoots: false,
		bundledSkillDir: root
	});
}
//#endregion
//#region src/home.ts
/** Official precedence: `$DSH_HOME`, then `~/.dsh`. `packages/util/home-paths/README.md`. */
function resolveDshHome(env = process.env) {
	const fromEnv = env.DSH_HOME?.trim();
	if (fromEnv) return resolve(fromEnv);
	return join(homedir(), ".dsh");
}
//#endregion
//#region src/catalog-types.ts
/** Hints for known logins whose adapter is missing; not an allowlist for live adapters. */
const OAUTH_ROUTE_BY_STORE_ID = {
	"openai-codex": "pi-openai-codex",
	anthropic: "pi-anthropic",
	xai: "pi-xai",
	"github-copilot": "pi-github-copilot",
	openrouter: "pi-openrouter",
	"kimi-coding": "pi-kimi-coding",
	antigravity: "agy-google-antigravity"
};
function storeIdForRoute(route) {
	if (route.startsWith("pi-") && route.length > 3) return route.slice(3);
	if (route === "agy-google-antigravity" || route.startsWith("agy-")) return "antigravity";
}
//#endregion
//#region src/roles.ts
/**
* pstack role keys used by playbooks and Settings → pstack.
* These are pstack names, not Cursor slugs and not grok-build `subagent_type` values.
*/
const SCALAR_ROLES = [
	"feature",
	"refactoring",
	"bug-fix",
	"perf-issue",
	"hillclimb",
	"judgment-and-prose",
	"hardest-tasks",
	"how-explorer",
	"how-explainer",
	"why-investigators",
	"why-synthesizer",
	"reflect-tooling",
	"reflect-judgment",
	"swarm-workers",
	"independent-verifier",
	"poteto-agent",
	"comment-sicko"
];
const PANEL_ROLES = [
	"how-critics",
	"arena-runners",
	"arena-cross-judge-pool",
	"architect-runners",
	"interrogate-reviewers"
];
const ALL_ROLES = [...SCALAR_ROLES, ...PANEL_ROLES];
function isPstackRole(value) {
	return ALL_ROLES.includes(value);
}
function isPanelRole(value) {
	return PANEL_ROLES.includes(value);
}
/** Alias accepted from Cursor-era skills. */
function normalizeRole(raw) {
	const trimmed = raw.trim();
	if (trimmed === "Comment Sicko" || trimmed === "comment sicko") return "comment-sicko";
	if (trimmed === "poteto-agent" || trimmed === "Poteto Agent") return "poteto-agent";
	if (trimmed === "generalPurpose" || trimmed === "general-purpose") return "poteto-agent";
	return trimmed;
}
function emptyOverlay() {
	const roles = {};
	for (const role of ALL_ROLES) roles[role] = {
		inherit: true,
		routes: []
	};
	return {
		version: 1,
		roles
	};
}
function routeKey(provider, model) {
	return `${provider}::${model}`;
}
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseRoute(raw, path) {
	if (!isRecord$2(raw)) throw new Error(`${path} must be an object`);
	const provider = raw.provider;
	const model = raw.model;
	if (typeof provider !== "string" || provider.length === 0) throw new Error(`${path}.provider must be a non-empty string`);
	if (typeof model !== "string" || model.length === 0) throw new Error(`${path}.model must be a non-empty string`);
	const effort = raw.reasoningEffort;
	if (effort !== void 0 && (typeof effort !== "string" || effort.length === 0)) throw new Error(`${path}.reasoningEffort must be a non-empty string when set`);
	const extra = Object.keys(raw).filter((key) => key !== "provider" && key !== "model" && key !== "reasoningEffort");
	if (extra.length > 0) throw new Error(`${path} has unknown fields: ${extra.join(", ")}`);
	return effort === void 0 ? {
		provider,
		model
	} : {
		provider,
		model,
		reasoningEffort: effort
	};
}
function parseRole(raw, role) {
	if (!isRecord$2(raw)) throw new Error(`roles.${role} must be an object`);
	const extra = Object.keys(raw).filter((key) => key !== "inherit" && key !== "routes");
	if (extra.length > 0) throw new Error(`roles.${role} has unknown fields: ${extra.join(", ")}`);
	const inherit = raw.inherit === true || raw.inherit === "true" || raw.inherit === "inherit-parent" || raw.inherit === "auto";
	const routesRaw = raw.routes;
	const routes = Array.isArray(routesRaw) ? routesRaw.map((entry, index) => parseRoute(entry, `roles.${role}.routes[${index}]`)) : [];
	if (inherit) return {
		inherit: true,
		routes: []
	};
	if (routes.length === 0) return {
		inherit: true,
		routes: []
	};
	if (!isPanelRole(role) && routes.length !== 1) throw new Error(`roles.${role} is a scalar role and may have at most one route`);
	return {
		inherit: false,
		routes
	};
}
function parseOverlay(text) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error("pstack-dsh overlay is not valid JSON");
	}
	if (!isRecord$2(value)) throw new Error("pstack-dsh overlay must be an object");
	if (value.version !== 1) throw new Error(`pstack-dsh overlay version ${String(value.version)} is unsupported`);
	const extra = Object.keys(value).filter((key) => key !== "version" && key !== "roles");
	if (extra.length > 0) throw new Error(`pstack-dsh overlay has unknown fields: ${extra.join(", ")}`);
	const rolesRaw = value.roles;
	if (!isRecord$2(rolesRaw)) throw new Error("pstack-dsh overlay.roles must be an object");
	const roles = {};
	for (const role of ALL_ROLES) {
		const entry = rolesRaw[role];
		roles[role] = entry === void 0 ? {
			inherit: true,
			routes: []
		} : parseRole(entry, role);
	}
	for (const key of Object.keys(rolesRaw)) if (!isPstackRole(key)) throw new Error(`unknown pstack role "${key}"`);
	return {
		version: 1,
		roles
	};
}
function validateOverlayAgainstCatalog(overlay, routes) {
	const errors = [];
	const live = new Map(routes.filter((route) => route.selectable).map((route) => [routeKey(route.provider, route.model), route]));
	for (const role of ALL_ROLES) {
		if (role === "how-critics") continue;
		const assignment = overlay.roles[role] ?? {
			inherit: true,
			routes: []
		};
		if (assignment.inherit) continue;
		for (const [index, entry] of assignment.routes.entries()) {
			const found = live.get(routeKey(entry.provider, entry.model));
			if (found === void 0) {
				errors.push(`${role}[${index}]: ${entry.provider}/${entry.model} is not a logged-in live route`);
				continue;
			}
			if (entry.reasoningEffort === void 0) continue;
			if (found.efforts.length === 0) {
				errors.push(`${role}[${index}]: ${entry.provider}/${entry.model} has no effort field; omit reasoningEffort`);
				continue;
			}
			if (!found.efforts.some((effort) => effort.id === entry.reasoningEffort)) errors.push(`${role}[${index}]: effort "${entry.reasoningEffort}" is not accepted by ${entry.provider}/${entry.model} (live: ${found.efforts.map((effort) => effort.id).join(", ")})`);
		}
	}
	return errors;
}
function resolveRole(overlay, role) {
	const key = role;
	return overlay.roles[key] ?? {
		inherit: true,
		routes: []
	};
}
//#endregion
//#region src/overlay.ts
function overlayPath(dshHome = resolveDshHome()) {
	return join(dshHome, OVERLAY_FILENAME);
}
async function readOverlay(dshHome = resolveDshHome()) {
	const path = overlayPath(dshHome);
	try {
		return {
			path,
			overlay: parseOverlay(await readFile(path, "utf8")),
			missing: false
		};
	} catch (error) {
		if (error.code === "ENOENT") return {
			path,
			overlay: emptyOverlay(),
			missing: true
		};
		throw error;
	}
}
async function writeOverlay(overlay, dshHome = resolveDshHome()) {
	const path = overlayPath(dshHome);
	await writeFileAtomic(path, `${JSON.stringify(overlay, null, 2)}\n`, {
		mode: 384,
		dirMode: 448
	});
	return path;
}
//#endregion
//#region src/catalog.ts
const API_KEY_REF = /^[A-Za-z_][A-Za-z0-9_]*$/;
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function collectApiKeyEnvRefs(value, out) {
	if (Array.isArray(value)) {
		for (const item of value) collectApiKeyEnvRefs(item, out);
		return;
	}
	if (!isRecord$1(value)) return;
	for (const [key, child] of Object.entries(value)) if (key === "apiKeyEnv" && typeof child === "string" && API_KEY_REF.test(child)) out.add(child);
	else collectApiKeyEnvRefs(child, out);
}
function sliceAtPath(value, path) {
	let current = value;
	for (const segment of path) {
		if (!isRecord$1(current)) return void 0;
		current = current[segment];
	}
	return current;
}
function settingsValue(entry) {
	if (!isRecord$1(entry)) return void 0;
	return entry.value ?? entry.base ?? entry.user;
}
function settingsNs(entry) {
	if (!isRecord$1(entry)) return void 0;
	return typeof entry.ns === "string" ? entry.ns : void 0;
}
async function refConfigured(credentials, env, ref) {
	if (credentials !== void 0) try {
		return (await credentials.describe(ref)).configured === true;
	} catch {
		return false;
	}
	const ambient = env[ref];
	return typeof ambient === "string" && ambient.trim().length > 0;
}
async function readOauthStoreIds(dshHome) {
	const candidates = [join(dshHome, OAUTH_AUTH_FILENAME), join(dshHome, OAUTH_AUTH_LEGACY_FILENAME)];
	let present = false;
	const ids = /* @__PURE__ */ new Set();
	for (const filename of candidates) try {
		const text = await readFile(filename, "utf8");
		const parsed = JSON.parse(text);
		if (!isRecord$1(parsed) || !isRecord$1(parsed.credentials)) continue;
		present = true;
		for (const key of Object.keys(parsed.credentials)) ids.add(key);
		break;
	} catch (error) {
		if (error.code === "ENOENT") continue;
		present = true;
		break;
	}
	try {
		const text = await readFile(join(dshHome, ANTIGRAVITY_AUTH_FILENAME), "utf8");
		const parsed = JSON.parse(text);
		if (isRecord$1(parsed) && isRecord$1(parsed.credential)) {
			present = true;
			const cred = parsed.credential;
			if (cred.type === "oauth" && typeof cred.projectId === "string" && cred.projectId.trim().length > 0 && typeof cred.expires === "number" && cred.expires > 0) ids.add("antigravity");
		}
	} catch (error) {
		if (error.code !== "ENOENT") present = true;
	}
	return {
		present,
		ids: [...ids]
	};
}
function effortsOf(info) {
	const reasoning = info.reasoning;
	if (reasoning === void 0 || !Array.isArray(reasoning.efforts)) return { efforts: [] };
	return {
		efforts: reasoning.efforts.map((effort) => ({
			id: effort.id,
			name: effort.name,
			...effort.description === void 0 ? {} : { description: effort.description }
		})),
		...reasoning.defaultEffort === void 0 ? {} : { defaultEffort: reasoning.defaultEffort }
	};
}
/**
* Live logged-in routes only. No vendor catalog. No invented slugs.
*/
async function buildCatalog(host, signal) {
	const dshHome = host.dshHome ?? resolveDshHome(host.env);
	const env = host.env ?? process.env;
	const overlay = await readOverlay(dshHome);
	const oauth = await readOauthStoreIds(dshHome);
	const llm = host.llm;
	const providers = llm?.listProviders() ?? [];
	const registered = new Set(providers.map((provider) => provider.id));
	const oauthPluginPresent = [...registered].some((id) => id.startsWith("pi-") || id === "agy-google-antigravity" || id.startsWith("agy-"));
	const recommendOauthLogin = oauth.ids.length === 0 && !oauthPluginPresent;
	const refsByProvider = /* @__PURE__ */ new Map();
	const remember = (provider, ref) => {
		const set = refsByProvider.get(provider) ?? /* @__PURE__ */ new Set();
		set.add(ref);
		refsByProvider.set(provider, set);
	};
	if (host.settings !== void 0) {
		let described = [];
		try {
			described = host.settings.describe({ redactSecrets: true });
		} catch {
			described = [];
		}
		const configurable = llm?.listConfigurableProviders?.() ?? [];
		for (const entry of described) {
			const ns = settingsNs(entry);
			const value = settingsValue(entry);
			for (const row of configurable) {
				if (ns !== void 0 && row.settingsNs !== ns) continue;
				const slice = row.settingsPath.length === 0 ? value : sliceAtPath(value, row.settingsPath);
				if (slice === void 0) continue;
				const refs = /* @__PURE__ */ new Set();
				collectApiKeyEnvRefs(slice, refs);
				for (const ref of refs) remember(row.provider, ref);
			}
		}
	}
	for (const provider of providers) if (provider.id === "deepseek-official") remember(provider.id, DEEPSEEK_API_KEY_ENV);
	for (const row of llm?.listConfigurableProviders?.() ?? []) for (const ref of row.nativeAuth?.env ?? []) if (API_KEY_REF.test(ref)) remember(row.provider, ref);
	const routes = [];
	const seen = /* @__PURE__ */ new Set();
	const push = (route) => {
		const key = `${route.provider}::${route.model}`;
		if (seen.has(key)) return;
		seen.add(key);
		routes.push(route);
	};
	if (llm !== void 0) for (const provider of providers) {
		const storeId = storeIdForRoute(provider.id);
		const oauthSignedIn = storeId !== void 0 && oauth.ids.includes(storeId);
		let models = [];
		try {
			models = await llm.listModels(provider.id);
		} catch {
			models = [];
		}
		if (models.length === 0) continue;
		const refs = [...refsByProvider.get(provider.id) ?? []];
		let keyPresent = false;
		for (const ref of refs) if (await refConfigured(host.credentials, env, ref)) {
			keyPresent = true;
			break;
		}
		const localPassthrough = provider.id === "cursor";
		const pluginLogin = storeId === void 0 && refs.length === 0 && !localPassthrough && !provider.id.startsWith("local-");
		const selectable = oauthSignedIn || keyPresent || localPassthrough || pluginLogin;
		const source = oauthSignedIn ? "oauth" : localPassthrough ? "local" : keyPresent ? "api-key" : "plugin";
		if (!selectable) continue;
		for (const model of models) {
			let resolved;
			try {
				resolved = await llm.resolveModelInfo(provider.id, model.id, signal);
			} catch {
				resolved = {
					id: model.id,
					name: model.name
				};
			}
			const { efforts, defaultEffort } = effortsOf(resolved);
			push({
				provider: provider.id,
				providerName: provider.name,
				model: model.id,
				modelName: resolved.name || model.name,
				selectable: true,
				source,
				...oauthSignedIn ? { oauthSignedIn: true } : {},
				routeRegistered: true,
				efforts,
				...defaultEffort === void 0 ? {} : { defaultEffort }
			});
		}
	}
	for (const id of oauth.ids) {
		const route = OAUTH_ROUTE_BY_STORE_ID[id];
		if (route === void 0) continue;
		if (registered.has(route)) continue;
		const isAntigravity = id === "antigravity" || route === "agy-google-antigravity";
		push({
			provider: route,
			providerName: isAntigravity ? "Google Antigravity" : id,
			model: "*",
			modelName: isAntigravity ? "(install dsh-antigravity-oauth to load this route)" : "(install dsh-oauth-login to load this route)",
			selectable: false,
			source: "oauth",
			oauthSignedIn: true,
			routeRegistered: false,
			efforts: [],
			hint: isAntigravity ? "Signed in at $DSH_HOME/.dsh-antigravity-oauth.json. Install dsh-antigravity-oauth so the route is live." : "Signed in at $DSH_HOME/.dsh-oauth-auth.json. Install https://github.com/aa2246740/dsh-oauth-login so the route is live."
		});
	}
	const selectableCount = routes.filter((route) => route.selectable).length;
	return {
		routes,
		selectableCount,
		oauthPluginPresent,
		oauthStorePresent: oauth.present,
		oauthSignedInProviders: oauth.ids,
		overlayPath: overlay.path,
		overlayMissing: overlay.missing,
		inheritParent: true,
		recommendOauthLogin,
		...selectableCount === 0 ? { emptyReason: recommendOauthLogin ? "No logged-in API key and no dsh-oauth-login or dsh-antigravity-oauth store. Children inherit this conversation. Add a key in DSH, or install/login https://github.com/aa2246740/dsh-oauth-login / dsh-antigravity-oauth." : "No selectable live route. Children inherit this conversation." } : {}
	};
}
//#endregion
//#region src/persona.ts
function defaultAgentsRoot() {
	return join(dirname(fileURLToPath(import.meta.url)), "..", "agents");
}
function stripFrontmatter(text) {
	if (!text.startsWith("---")) return text;
	const end = text.indexOf("\n---", 3);
	if (end < 0) return text;
	return text.slice(end + 4).replace(/^\s*\n/, "");
}
/**
* Persona for a pstack role. Official spawn persona shadows deployment persona
* (`SubagentStartRequest.persona`, `packages/subagent/subagent/src/types.ts`).
*/
async function loadPersona(role, agentsRoot = defaultAgentsRoot()) {
	const key = normalizeRole(role);
	const files = key === "comment-sicko" ? ["comment-sicko.md"] : key === "poteto-agent" ? ["poteto-agent.md"] : [`${key}.md`, "poteto-agent.md"];
	for (const file of files) try {
		const body = stripFrontmatter(await readFile(join(agentsRoot, file), "utf8")).trim();
		if (body.length > 0) return body;
	} catch {
		continue;
	}
}
//#endregion
//#region src/spawn.ts
function resolveSpawn(overlay, request) {
	const role = normalizeRole(request.role);
	const assignment = resolveRole(overlay, role);
	const inherit = assignment.inherit || assignment.routes.length === 0;
	const index = request.routeIndex ?? 0;
	if (!inherit && (!Number.isInteger(index) || index < 0 || index >= assignment.routes.length)) throw new Error(`pstack_spawn route_index ${String(request.routeIndex)} is outside ${assignment.routes.length} route(s) for ${role}`);
	const route = inherit ? void 0 : assignment.routes[index];
	return {
		role,
		description: request.description,
		prompt: request.prompt,
		runInBackground: request.runInBackground,
		inherit,
		...route === void 0 ? {} : {
			agentOptions: {
				provider: route.provider,
				model: route.model,
				...route.reasoningEffort === void 0 ? {} : { reasoningEffort: ReasoningEffortId(route.reasoningEffort) }
			},
			route
		}
	};
}
function assertSelectableRoute(route, routes) {
	const match = routes.find((item) => item.selectable && item.provider === route.provider && item.model === route.model);
	if (match === void 0) throw new Error(`pstack_spawn route ${route.provider}/${route.model} is not a selectable live route. Refusing to substitute another route.`);
	if (route.reasoningEffort !== void 0 && !match.efforts.some((effort) => effort.id === route.reasoningEffort)) throw new Error(`pstack_spawn route ${route.provider}/${route.model} does not list reasoning effort "${route.reasoningEffort}". Refusing to substitute another effort.`);
}
//#endregion
//#region src/tools.ts
function textPrompt(prompt) {
	return [{
		type: "text",
		text: prompt
	}];
}
function catalogTool(host) {
	return {
		name: TOOL_CATALOG,
		description: "List live DSH LLM routes pstack may use: registered adapters with a logged-in API key, plus OAuth store routes (dsh-oauth-login, dsh-antigravity-oauth) that are already signed in. Never a vendor catalog. Secrets are omitted.",
		parameters: {},
		async execute(_args, exec) {
			return buildCatalog({
				llm: host.llm,
				credentials: host.credentials,
				settings: host.settings,
				dshHome: host.dshHome,
				env: host.env
			}, exec.signal);
		}
	};
}
function overlayReadTool(host) {
	return {
		name: TOOL_OVERLAY_READ,
		description: "Read $DSH_HOME/pstack-dsh.json. Missing file means inherit the parent conversation for every role.",
		parameters: {},
		async execute() {
			const current = await readOverlay(host.dshHome ?? resolveDshHome(host.env));
			return {
				path: current.path,
				missing: current.missing,
				overlay: current.overlay
			};
		}
	};
}
function overlayWriteTool(host) {
	return {
		name: TOOL_OVERLAY_WRITE,
		description: "Write $DSH_HOME/pstack-dsh.json after validating every provider/model/effort against pstack_catalog. inherit-parent is stored as inherit: true with empty routes.",
		parameters: { overlay: {
			type: "json",
			required: true,
			description: "Full overlay object { version: 1, roles: { <role>: { inherit, routes } } }"
		} },
		async execute(args) {
			const overlay = typeof args.overlay === "string" ? parseOverlay(args.overlay) : parseOverlay(JSON.stringify(args.overlay));
			const errors = validateOverlayAgainstCatalog(overlay, (await buildCatalog({
				llm: host.llm,
				credentials: host.credentials,
				settings: host.settings,
				dshHome: host.dshHome,
				env: host.env
			})).routes);
			if (errors.length > 0) throw new Error(`overlay rejected against live catalog:\n${errors.join("\n")}`);
			return {
				path: await writeOverlay(overlay, host.dshHome ?? resolveDshHome(host.env)),
				overlay
			};
		}
	};
}
function spawnTool(host) {
	return {
		name: TOOL_SPAWN,
		description: "Delegate a pstack role through ctx.subagents.startActivation on the spawn provider. Send description, prompt, role, optional cwd, and optional run_in_background. Do not send model, provider, reasoning_effort, thinking, isolation, or subagent_type. A mapped overlay route is checked against the live catalog and placed on the child agentOptions before the first request. Omitted or true run_in_background returns the child id immediately and the runtime notifies the parent once. false waits for that result here and does not also notify the parent.",
		parameters: {
			description: {
				type: "string",
				required: true,
				description: "A short (3-5 word) description of the delegated task, for display."
			},
			prompt: {
				type: "string",
				required: true,
				description: "The complete, self-contained task. The child does not see this conversation."
			},
			role: {
				type: "string",
				required: true,
				description: "pstack role key (feature, how-explainer, poteto-agent, comment-sicko, …)."
			},
			cwd: {
				type: "string",
				description: "Initial child working directory. This is not a sandbox or a private worktree. Parallel writers need separate directories."
			},
			run_in_background: {
				type: "boolean",
				description: "Default true. true returns the child id and lets the runtime notify the parent once. false waits for the result in this call and does not also notify the parent."
			},
			route_index: {
				type: "number",
				description: "Which overlay route to use for a panel role. Default 0."
			}
		},
		async execute(args, exec) {
			const parent = exec.agent;
			if (parent === void 0) throw new Error("pstack_spawn requires a calling agent");
			const subagents = host.subagents;
			if (subagents === void 0) throw new Error("pstack_spawn requires ctx.subagents");
			const role = normalizeRole(String(args.role ?? ""));
			if (role === "how-critics") return {
				kind: "disabled",
				role,
				reason: "how-critics was retired in pstack 0.15; no agent was started."
			};
			if (!isPstackRole(role) && role.length === 0) throw new Error("pstack_spawn role is required");
			const overlay = (await readOverlay(host.dshHome ?? resolveDshHome(host.env))).overlay;
			const resolved = resolveSpawn(overlay, {
				role,
				description: String(args.description ?? ""),
				prompt: String(args.prompt ?? ""),
				runInBackground: args.run_in_background !== false,
				routeIndex: typeof args.route_index === "number" ? args.route_index : void 0
			});
			if (resolved.description.trim().length === 0) throw new Error("description is required");
			if (resolved.prompt.trim().length === 0) throw new Error("prompt is required");
			if (resolved.route !== void 0) {
				if (host.llm === void 0) throw new Error("pstack_spawn cannot check route authorization because the llm service is unavailable");
				const catalog = await buildCatalog({
					llm: host.llm,
					credentials: host.credentials,
					settings: host.settings,
					dshHome: host.dshHome,
					env: host.env
				}, exec.signal);
				assertSelectableRoute(resolved.route, catalog.routes);
			}
			const persona = await loadPersona(resolved.role);
			const prompt = persona === void 0 ? resolved.prompt : `${persona}\n\n${resolved.prompt}`;
			const providerName = host.spawnProvider ?? "spawn";
			const provider = subagents.getProvider?.(providerName);
			const preset = presetForRole(resolved.role);
			const presetSupported = provider?.capabilities?.agentPreset === true && provider.inheritsParentContext !== true;
			if (preset.restrictsWrites && !presetSupported) throw new Error(`pstack_spawn role ${resolved.role} requires agent preset ${preset.id}, but provider "${providerName}" cannot apply an independent preset. Refusing to start with only a prompt restriction.`);
			const signal = exec.signal ?? new AbortController().signal;
			const maxDepth = subagents.resolveMaxDepth?.();
			const request = {
				prompt: textPrompt(prompt),
				parent,
				...typeof args.cwd === "string" && args.cwd.length > 0 ? { cwd: args.cwd } : {},
				...resolved.agentOptions === void 0 ? {} : { agentOptions: resolved.agentOptions },
				...presetSupported ? { agentPreset: preset.id } : {},
				...maxDepth !== void 0 ? { maxDepth } : {}
			};
			const activation = await subagents.startActivation({
				provider: providerName,
				label: resolved.description,
				request,
				signal,
				delivery: resolved.runInBackground ? "parent" : "caller"
			});
			if (resolved.runInBackground) return {
				kind: "activation",
				subagentId: activation.childId,
				role: resolved.role,
				inherit: resolved.inherit
			};
			const cancel = () => {
				activation.dispose();
			};
			signal.addEventListener("abort", cancel, { once: true });
			try {
				if (signal.aborted) await activation.dispose();
				const result = await activation.result;
				await activation.dispose();
				return {
					kind: "foreground",
					subagentId: activation.childId,
					role: resolved.role,
					inherit: resolved.inherit,
					output: result.output ?? null,
					stopReason: result.stopReason ?? "completed"
				};
			} finally {
				signal.removeEventListener("abort", cancel);
			}
		}
	};
}
//#endregion
//#region src/http-trust.ts
/** Loopback + same-origin. Copied shape from dsh-oauth-login `src/auth-routes.ts`. */
function trustedRequest(req) {
	const remote = req.socket.remoteAddress;
	if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") return false;
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	const host = req.headers.host;
	if (host === void 0) return false;
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === new URL(`http://${host}`).host;
	} catch {
		return false;
	}
}
function json(res, status, value) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(value));
}
async function readJson(req, maxBytes = 262144) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > maxBytes) throw new Error("request body too large");
		chunks.push(chunk);
	}
	if (chunks.length === 0) return {};
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
//#endregion
//#region src/settings-draft.ts
function liveFor(routes, provider, model) {
	return routes.find((route) => route.selectable && route.provider === provider && route.model === model);
}
function stripIllegalEffort(route, live) {
	const found = liveFor(live, route.provider, route.model);
	if (found === void 0) return {
		provider: route.provider,
		model: route.model
	};
	if (route.reasoningEffort === void 0) return {
		provider: route.provider,
		model: route.model
	};
	if (found.efforts.length === 0) return {
		provider: route.provider,
		model: route.model
	};
	if (!found.efforts.some((effort) => effort.id === route.reasoningEffort)) return {
		provider: route.provider,
		model: route.model
	};
	return {
		provider: route.provider,
		model: route.model,
		reasoningEffort: route.reasoningEffort
	};
}
/** Stale overlay entries become inherit in the returned overlay; original file is not written. */
function dropUnselectableRoles(overlay, live) {
	const next = emptyOverlay();
	const droppedRoles = [];
	const selectable = new Set(live.filter((route) => route.selectable).map((route) => routeKey(route.provider, route.model)));
	for (const role of ALL_ROLES) {
		const assignment = overlay.roles[role] ?? {
			inherit: true,
			routes: []
		};
		if (role === "how-critics") {
			next.roles[role] = {
				inherit: assignment.inherit,
				routes: assignment.routes.map((route) => ({ ...route }))
			};
			continue;
		}
		if (assignment.inherit || assignment.routes.length === 0) {
			next.roles[role] = {
				inherit: true,
				routes: []
			};
			continue;
		}
		const kept = assignment.routes.filter((route) => selectable.has(routeKey(route.provider, route.model))).map((route) => stripIllegalEffort(route, live));
		if (kept.length === 0) {
			droppedRoles.push(role);
			next.roles[role] = {
				inherit: true,
				routes: []
			};
			continue;
		}
		if (kept.length !== assignment.routes.length) droppedRoles.push(role);
		next.roles[role] = {
			inherit: false,
			routes: isPanelRole(role) ? kept : [kept[0]]
		};
	}
	return {
		overlay: next,
		droppedRoles
	};
}
//#endregion
//#region src/settings-api.ts
async function loadSettingsSnapshot(host) {
	const dshHome = host.dshHome ?? resolveDshHome(host.env);
	const catalog = await buildCatalog({
		...host,
		dshHome
	});
	const current = await readOverlay(dshHome);
	const { overlay, droppedRoles } = dropUnselectableRoles(current.overlay, catalog.routes);
	return {
		catalog,
		overlay,
		path: current.path,
		missing: current.missing,
		droppedRoles
	};
}
async function saveSettingsOverlay(host, raw) {
	const dshHome = host.dshHome ?? resolveDshHome(host.env);
	const overlay = typeof raw === "string" ? parseOverlay(raw) : parseOverlay(JSON.stringify(raw));
	const errors = validateOverlayAgainstCatalog(overlay, (await buildCatalog({
		...host,
		dshHome
	})).routes);
	if (errors.length > 0) {
		const error = /* @__PURE__ */ new Error(`overlay rejected against live catalog:\n${errors.join("\n")}`);
		error.errors = errors;
		throw error;
	}
	return {
		path: await writeOverlay(overlay, dshHome),
		overlay
	};
}
//#endregion
//#region src/settings-routes.ts
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function handleSnapshot(host, req, res) {
	if (req.method !== "GET") {
		json(res, 405, { error: "method not allowed" });
		return;
	}
	json(res, 200, await loadSettingsSnapshot(host));
}
async function handleSave(host, req, res) {
	if (req.method !== "PUT" && req.method !== "POST") {
		json(res, 405, { error: "method not allowed" });
		return;
	}
	try {
		const body = await readJson(req);
		json(res, 200, await saveSettingsOverlay(host, isRecord(body) && "overlay" in body ? body.overlay : body));
	} catch (error) {
		const message = error instanceof Error ? error.message : "save failed";
		const errors = error instanceof Error && "errors" in error && Array.isArray(error.errors) ? error.errors : void 0;
		json(res, 400, {
			error: message,
			...errors === void 0 ? {} : { errors }
		});
	}
}
function registerPstackSettingsRoutes(ctx, host) {
	const webServer = ctx.webServer;
	if (webServer === void 0) return;
	ctx.effect(() => {
		const routes = [webServer.register({
			kind: "exact",
			path: SETTINGS_SNAPSHOT_PATH,
			handler: async (req, res) => {
				const rejection = ctx.connection.requestRejection(req);
				if (rejection !== void 0) {
					json(res, rejection, { error: rejection === 401 ? "unauthorized" : "forbidden" });
					return;
				}
				if (!trustedRequest(req)) {
					json(res, 403, { error: "forbidden" });
					return;
				}
				if (req.method === "GET") {
					await handleSnapshot(host, req, res);
					return;
				}
				await handleSave(host, req, res);
			}
		})];
		return () => {
			for (const dispose of routes) dispose();
		};
	}, "pstack-dsh: Settings overlay routes");
}
//#endregion
//#region src/index.ts
const name = PLUGIN_ID;
const inject = ["tools", "skills"];
const JSON_OUTPUT = {
	schema: { type: "json" },
	render: (_args, value) => [{
		type: "text",
		text: JSON.stringify(value, null, 2)
	}]
};
function asHost(ctx, config) {
	return {
		get llm() {
			return ctx.get("llm");
		},
		get credentials() {
			return ctx.get("credentials");
		},
		get settings() {
			return ctx.get("settings");
		},
		get subagents() {
			return ctx.get("subagents");
		},
		spawnProvider: config?.spawnProvider ?? "spawn"
	};
}
function registerOne(ctx, tool) {
	ctx.tools.register(defineTool({
		name: tool.name,
		description: tool.description,
		parameters: tool.parameters,
		output: JSON_OUTPUT,
		async execute(args, exec) {
			const snapshot = snapshotJsonValue(await tool.execute(args, exec));
			if (snapshot === void 0) throw new TypeError(`pstack tool ${tool.name} returned a non-JSON value`);
			return snapshot;
		}
	}));
}
function apply(ctx, config) {
	console.log(BOOT_MARKER);
	const host = asHost(ctx, config);
	registerOne(ctx, catalogTool(host));
	registerOne(ctx, overlayReadTool(host));
	registerOne(ctx, overlayWriteTool(host));
	registerOne(ctx, spawnTool(host));
	watchRolePresets(ctx);
	ctx.skills.registerProvider((control) => createSkillProvider(ctx, control));
	ctx.inject(["webServer", "connection"], (webCtx) => {
		registerPstackSettingsRoutes(webCtx, host);
	});
}
function presetRegistry(ctx) {
	const value = ctx.get("agentPresets");
	if (typeof value !== "object" || value === null || !("register" in value) || typeof value.register !== "function") return void 0;
	return value;
}
/**
* Register the role presets once the agentPresets service is up. In the live
* Host that service finishes starting after this plugin applies, so reading it
* during apply finds nothing; the inject scope also drops the presets with it.
*/
function watchRolePresets(ctx) {
	ctx.inject(["agentPresets"], registerRolePresets);
}
function registerRolePresets(ctx) {
	const presets = presetRegistry(ctx);
	if (presets === void 0) return;
	const definitions = [{
		id: POTETO_PRESET_ID,
		name: "Poteto",
		plugins: rolePresetPlugins(false)
	}, {
		id: COMMENT_SICKO_PRESET_ID,
		name: "Comment Sicko",
		plugins: rolePresetPlugins(true)
	}];
	for (const definition of definitions) ctx.effect(async () => {
		try {
			return await presets.register(definition);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`pstack-dsh: failed to register agent preset ${definition.id}: ${message}`);
			return () => {};
		}
	}, `pstack-dsh preset ${definition.id}`);
}
//#endregion
export { Config, apply, inject, name, registerRolePresets, watchRolePresets };
