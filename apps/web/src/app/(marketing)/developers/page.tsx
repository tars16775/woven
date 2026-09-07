import type { Metadata } from "next";
import Link from "next/link";
import { Block, Code, PageFrame } from "@/components/page-frame";
import { email } from "@/lib/brand";
import { AvailabilityTag } from "@/components/claim";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "A discoverable OpenAI-compatible endpoint on the LAN, a capability API with permissions and receipts, and a sandbox for agents.",
};

export default function DevelopersPage() {
  return (
    <PageFrame
      eyebrow="Developers"
      title="One endpoint on the LAN. Every action leaves a receipt."
      intro="Woven Core exposes a capability API today: every side effect it can cause is a named capability with a schema, a risk class, an approval rule and a receipt, and the engine that decides is a pure function you can test. Inference on the Inside, the agent sandbox and the robot endpoint are designed but not built, and each section below says which it is."
      aside={
        <div className="rounded-[14px] bg-bone p-5 text-[14px]">
          <div className="font-medium">Works with Woven</div>
          <p className="mt-2 text-ash">
            A badge for agents, devices and integrations that pass the contract tests. Opens
            with the pilot.
          </p>
          <a href={`mailto:${email.developers}`} className="mt-3 block font-medium underline decoration-amber decoration-2 underline-offset-4">
            {email.developers}
          </a>
        </div>
      }
    >
      <Block id="inference" title="Inference on the Inside">
        <p className="not-prose mb-4"><AvailabilityTag status="box" /></p>
        <p>
          The box advertises itself with mDNS and serves an OpenAI-compatible endpoint. Any
          app that can talk to a chat completions API can use the household&apos;s model without
          leaving the network. Requests are attributed to the person or agent that made them.
        </p>
        <Code>{`curl http://woven.local/v1/chat/completions \\
  -H "Authorization: Bearer $WOVEN_TOKEN" \\
  -d '{
    "model": "household-default",
    "messages": [{"role": "user", "content": "Summarise the lease in Files/Home"}]
  }'

# → served inside; a Gate crossing would require an approval the caller cannot grant`}</Code>
      </Block>

      <Block id="capabilities" title="Capability API">
        <p className="not-prose mb-4"><AvailabilityTag status="now" /></p>
        <p>
          Devices and services are exposed as typed capabilities, never as raw vendor calls.
          An action is prepared, optionally approved, executed with an idempotency key, then
          verified against the device before a receipt is written.
        </p>
        <Code>{`POST /v1/actions/prepare
{ "actor": "agent:sweep", "capability": "robot.clean",
  "target": "robot.living_room", "parameters": { "rooms": ["kitchen"] } }
→ { "action_id": "act_8f2", "risk_class": "B", "approval_required": false,
    "preview": "Clean the kitchen with Sweep", "expires_at": "…" }

POST /v1/actions/act_8f2/execute
Idempotency-Key: 5a1c…
→ { "execution_id": "exe_41", "status": "running" }

GET /v1/executions/exe_41
→ { "planned_state": {…}, "observed_state": {…},
    "verification": "ok", "receipt_id": "rcp_77" }`}</Code>
        <p>
          Class D and above (locks, purchases, admin) return an approval requirement that only
          a household member can satisfy from the app or the screen. There is no token scope
          that bypasses it.
        </p>
      </Block>

      <Block id="agents" title="Agents">
        <p className="not-prose mb-4"><AvailabilityTag status="box" /></p>
        <p>
          An agent is a container with a manifest. The manifest names the capabilities and
          namespaces it wants; the household grants a subset; the box issues short-lived
          credentials for exactly that subset. Revoking the agent invalidates them.
        </p>
        <Code>{`# woven-agent.yaml
name: grocer
description: Reorders staples under a limit you set
runtime: openclaw@2
requests:
  capabilities: [commerce.order, list.read]
  namespaces: [household.shopping]
limits:
  spend_per_order_usd: 50
  merchants: approved_only
receipts: required`}</Code>
        <p>
          Agents cannot read each other&apos;s memory, cannot reach the camera or voice pipelines,
          and cannot call the network except through capabilities they were granted. Skill
          marketplaces are curated and signed.
        </p>
      </Block>

      <Block id="robots" title="Robots and devices">
        <p className="not-prose mb-4"><AvailabilityTag status="box" /></p>
        <p>
          Robots use the same endpoint for high-level tasks and for inference against the
          household world model. Safety and motor control stay on the robot. Woven records
          when a remote human operator is connected and enforces no-go zones the household
          has set.
        </p>
      </Block>

      <Block id="home-assistant" title="Home Assistant">
        <p className="not-prose mb-4"><AvailabilityTag status="box" /></p>
        <p>
          Home Assistant runs inside the box. Existing integrations, automations and
          dashboards carry over. Woven adds the identity, permission and receipt layer on top,
          so an automation that unlocks a door still needs a household member&apos;s approval the
          first time.
        </p>
        <p>
          <Link href="/tandem">How Tandem decides</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </Block>
    </PageFrame>
  );
}
