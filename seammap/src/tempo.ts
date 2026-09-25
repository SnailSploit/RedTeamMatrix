// TEMPORAL AXIS — the third structural dimension of the SEAMMAP trust hypergraph.
//
// Current model: Mechanism (primitive) × Relationship (trust edge)
// With this module: + Time (how long the seam door stays open, or what opens it)
//
// A seam is not just a point in (primitive × relationship) space — it is a surface
// whose Z-extent is its exploitability window. An attack campaign is a trajectory
// through 3D space; the scheduler must plan *when* to traverse, not just *whether*.
//
// This module provides:
//   tempoOf(s)             — TempoProfile for a seam (explicit override or heuristic)
//   classifyTempoCompat()  — how hard is it to chain two seams given their tempos?
//   campaignTimeline()     — group seams into the 5 temporal bands for the Campaign view

import type { Seam, TempoClass, TempoProfile, TemporalCompat, TempoCompatClass } from "./types.ts";

// ---------------------------------------------------------------------------
// Window descriptors for each tempo class
// ---------------------------------------------------------------------------
export const TEMPO_META: Record<TempoClass, { label: string; window_label: string; seconds?: number; color: string }> = {
  instant:      { label: "Instant",      window_label: "< 1 second",   seconds: 1,         color: "#e6194b" },
  session:      { label: "Session",      window_label: "min – 10 hr",  seconds: 36_000,    color: "#f0a93b" },
  opportunistic:{ label: "Opportunistic",window_label: "event-gated",  seconds: 3_600,     color: "#bd93f9" },
  campaign:     { label: "Campaign",     window_label: "days – weeks", seconds: 1_209_600, color: "#56d4dd" },
  persistent:   { label: "Persistent",   window_label: "indefinite",   seconds: undefined, color: "#7ee787" },
};

// ---------------------------------------------------------------------------
// Heuristic inference — classify a seam's tempo from its properties.
// Explicit overrides loaded from data/tempo.json take precedence at load time.
// ---------------------------------------------------------------------------

function kw(s: Seam): string {
  return [s.id, ...s.techniques.map((t) => t.name), s.trust_assumption, s.violation,
    ...s.classic_branches, s.rationale ?? ""].join(" ").toLowerCase();
}

export function inferTempo(s: Seam): TempoProfile {
  const w = kw(s);

  let cls: TempoClass;
  let trigger: string | undefined;

  if (s.primitive === "P6") {
    // Time/state primitive: race conditions are instant; token expiry / replay are session-scoped.
    cls = /replay|idempotency|token expiry|stale|business.logic/.test(w) ? "session" : "instant";

  } else if (s.primitive === "P3") {
    // Provenance: CI/CD pushes and webhooks are event-gated; supply chain is campaign-pace.
    if (/ci\/cd|pipeline|webhook|github action|runner|build system/.test(w)) {
      cls = "opportunistic";
      trigger = /webhook/.test(w) ? "webhook event"
        : /pipeline|runner|ci/.test(w) ? "CI/CD pipeline run"
        : "build/deploy event";
    } else if (/supply chain|dependency|npm package|package registry|bootkit|rootkit/.test(w)) {
      cls = "campaign";
    } else {
      cls = "campaign";
    }

  } else if (s.primitive === "P2") {
    // Identity→Authority: misconfigured IAM/SSRF are persistent; token/session-bound are session.
    if (/iam|ssrf|imds|misconfigur|over-privileged|persistent access|service account|cloud role/.test(w)) {
      cls = "persistent";
    } else if (/jwt|oauth|saml|kerberos|ticket|bearer|token|session|credential/.test(w)) {
      cls = "session";
    } else {
      cls = "session";
    }

  } else if (s.primitive === "P4") {
    // Context-inheritance: persistence mechanisms survive reboots (persistent); others are session.
    if (/boot|autostart|scheduled task|cron|run key|startup|wmi subscription|rootkit/.test(w)) {
      cls = "persistent";
    } else if (/ambient credential|cloud metadata|memory carryover|dead.drop/.test(w)) {
      cls = "persistent";
    } else {
      cls = "session";
    }

  } else if (s.primitive === "P5") {
    // Format-boundary: request smuggling and covert channels are opportunistic/session.
    if (/smuggling|desync|http.*desync/.test(w)) {
      cls = "opportunistic";
      trigger = "HTTP request";
    } else {
      cls = "session";
    }

  } else {
    // P1 — data→control: prompt injection is session (context window); web attacks are session.
    if (/prompt injection|jailbreak|memory carryover|context window/.test(w)) {
      cls = "session";
    } else if (/persist|implant|backdoor/.test(w)) {
      cls = "persistent";
    } else {
      cls = "session";
    }
  }

  // Override: explicit C2/beacon/persistence seams are always persistent regardless of primitive.
  if (/c2 beacon|malleable beacon|covert channel|dns tunnel|saas.*c2|redirector|domain.front/.test(w)) {
    cls = "persistent";
  }
  if (/exfiltration|data staging|crown.jewel|domain admin|tier.0/.test(w)) {
    cls = "campaign";
  }
  // Frontier seams with zero tooling default to campaign-pace (research is needed first).
  if (s.maturity === "frontier" && s.tooling_status === "none" && cls === "session") {
    cls = "campaign";
  }

  const meta = TEMPO_META[cls];
  return {
    class: cls,
    window_label: meta.window_label,
    ...(meta.seconds !== undefined ? { window_seconds: meta.seconds } : {}),
    ...(trigger ? { trigger } : {}),
  };
}

// Return the authoritative tempo for a seam: explicit override (set by model.ts from
// data/tempo.json) wins; otherwise infer heuristically.
export function tempoOf(s: Seam): TempoProfile {
  return s.tempo ?? inferTempo(s);
}

// ---------------------------------------------------------------------------
// Temporal compatibility: how hard is it to chain seam B (entry) → seam A (propagation)?
// Entry lands the attacker on a node; propagation fires from there. The window of entry
// must overlap with, or persist long enough to enable, the window of propagation.
// ---------------------------------------------------------------------------

type CompatRow = { cls: TempoCompatClass; factor: number; constraint: string };

// COMPAT_TABLE[entry_class][prop_class]
const COMPAT_TABLE: Record<TempoClass, Record<TempoClass, CompatRow>> = {
  instant: {
    instant:      { cls: "synchronized", factor: 0.40, constraint: "both seams must fire sub-second — requires precise tooling synchronization" },
    session:      { cls: "synchronized", factor: 0.60, constraint: "race-condition entry must deliver a foothold that survives into the session window" },
    opportunistic:{ cls: "synchronized", factor: 0.50, constraint: "race entry must coincide exactly with the event window — dual synchronization" },
    campaign:     { cls: "sequential",   factor: 0.70, constraint: "instant entry must be preserved or re-exploited before campaign-pace propagation can proceed" },
    persistent:   { cls: "decoupled",    factor: 1.00, constraint: "persistent propagation is available indefinitely; instant entry just needs to land once" },
  },
  session: {
    instant:      { cls: "synchronized", factor: 0.60, constraint: "propagation races against session expiry — tight window, fails on slow networks" },
    session:      { cls: "sequential",   factor: 0.90, constraint: "both chain within the same session window — feasible but time-boxed" },
    opportunistic:{ cls: "sequential",   factor: 0.80, constraint: "session must remain live until the opportunistic event fires" },
    campaign:     { cls: "sequential",   factor: 0.80, constraint: "session entry must be refreshed or promoted to persistent to survive campaign pace" },
    persistent:   { cls: "decoupled",    factor: 1.10, constraint: "session provides initial foothold; persistent propagation proceeds at its own pace" },
  },
  opportunistic: {
    instant:      { cls: "synchronized", factor: 0.50, constraint: "event window and sub-second race must align exactly" },
    session:      { cls: "sequential",   factor: 0.80, constraint: "entry during event window; session propagation must follow within session lifetime" },
    opportunistic:{ cls: "synchronized", factor: 0.60, constraint: "two independent event windows must coincide — dual-event synchronization" },
    campaign:     { cls: "sequential",   factor: 0.90, constraint: "event opens the door; campaign-pace propagation proceeds on its own clock thereafter" },
    persistent:   { cls: "decoupled",    factor: 1.10, constraint: "next event trigger yields persistent access — just wait for the next CI push" },
  },
  campaign: {
    instant:      { cls: "sequential",   factor: 0.70, constraint: "slow campaign entry must catch instant propagation at a precise moment" },
    session:      { cls: "sequential",   factor: 0.80, constraint: "campaign-pace positioning must arrive within a live session window" },
    opportunistic:{ cls: "sequential",   factor: 0.90, constraint: "campaign entry times its arrival to coincide with the event trigger" },
    campaign:     { cls: "sequential",   factor: 1.00, constraint: "standard kill-chain sequencing — both operate at campaign pace" },
    persistent:   { cls: "decoupled",    factor: 1.20, constraint: "campaign entry feeds permanently-available propagation — easy chaining" },
  },
  persistent: {
    instant:      { cls: "sequential",   factor: 0.80, constraint: "persistent access enables instant propagation on demand — attacker chooses the moment" },
    session:      { cls: "decoupled",    factor: 1.10, constraint: "persistent access allows re-exploitation whenever a fresh session opens" },
    opportunistic:{ cls: "decoupled",    factor: 1.10, constraint: "persistent foothold waits for the next event-triggered opportunity" },
    campaign:     { cls: "decoupled",    factor: 1.20, constraint: "persistent entry is always available; campaign propagation proceeds unimpeded" },
    persistent:   { cls: "decoupled",    factor: 1.30, constraint: "both seams are persistently open — most operationally relaxed composite" },
  },
};

export function classifyTempoCompat(entry: Seam, prop: Seam): TemporalCompat {
  const ec = tempoOf(entry).class;
  const pc = tempoOf(prop).class;
  const row = COMPAT_TABLE[ec][pc];
  return { class: row.cls, window_constraint: row.constraint, score_factor: row.factor };
}

// ---------------------------------------------------------------------------
// Campaign timeline — group seams into the five temporal bands.
// This is the (primitive × tempo) floor-projection of the 3D graph:
// the Z-axis laid flat as columns, primitives as rows.
// ---------------------------------------------------------------------------

export interface TimelineBand {
  class: TempoClass;
  label: string;
  window_label: string;
  color: string;
  seam_ids: string[];
  by_primitive: Record<string, string[]>; // primitive id -> seam ids in this band
}

export function campaignTimeline(seams: Seam[]): TimelineBand[] {
  const ORDER: TempoClass[] = ["instant", "session", "opportunistic", "campaign", "persistent"];
  const bands = new Map<TempoClass, { seam_ids: string[]; by_prim: Record<string, string[]> }>(
    ORDER.map((c) => [c, { seam_ids: [], by_prim: {} }]),
  );

  for (const s of seams) {
    const tc = tempoOf(s).class;
    const band = bands.get(tc)!;
    band.seam_ids.push(s.id);
    (band.by_prim[s.primitive] = band.by_prim[s.primitive] ?? []).push(s.id);
  }

  return ORDER.map((cls) => {
    const b = bands.get(cls)!;
    const meta = TEMPO_META[cls];
    return {
      class: cls,
      label: meta.label,
      window_label: meta.window_label,
      color: meta.color,
      seam_ids: b.seam_ids,
      by_primitive: b.by_prim,
    };
  });
}

// Stats summary for the bundle metadata
export interface TempoStats {
  by_class: Record<TempoClass, number>;
  compat_breakdown: Record<TempoCompatClass, number>;
}

export function tempoStats(seams: Seam[], composites: Array<{ temporal_compat?: TemporalCompat }>): TempoStats {
  const by_class: Record<TempoClass, number> = { instant: 0, session: 0, opportunistic: 0, campaign: 0, persistent: 0 };
  for (const s of seams) by_class[tempoOf(s).class]++;
  const compat_breakdown: Record<TempoCompatClass, number> = { synchronized: 0, sequential: 0, decoupled: 0 };
  for (const c of composites) if (c.temporal_compat) compat_breakdown[c.temporal_compat.class]++;
  return { by_class, compat_breakdown };
}
