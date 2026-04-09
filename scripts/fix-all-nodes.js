const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function fixAllNodes() {
  console.log("🚀 Starting Global Node Type Unification...");

  const { data: workflows, error: fetchError } = await supabaseAdmin
    .from("workflows")
    .select("*");

  if (fetchError) {
    console.error("❌ Failed to fetch workflows:", fetchError);
    return;
  }

  console.log(`🔍 Found ${workflows?.length} workflows/templates to process.`);

  for (const workflow of workflows || []) {
    let canvas = workflow.canvas_json;
    if (typeof canvas === 'string') {
      try {
        canvas = JSON.parse(canvas);
      } catch (e) {
        console.warn(`⚠️ Skipping "${workflow.name}" (Invalid JSON)`);
        continue;
      }
    }

    if (canvas && canvas.nodes) {
      let changed = false;
      const updatedNodes = canvas.nodes.map((node) => {
        // Unify everything that isn't HITL to AgentNode
        const targetType = (node.type === "HITLNode" || node.type === "human") ? "HITLNode" : "AgentNode";
        if (node.type !== targetType) {
          changed = true;
          return { ...node, type: targetType };
        }
        return node;
      });

      if (changed) {
        const { error: updateError } = await supabaseAdmin
          .from("workflows")
          .update({ canvas_json: { ...canvas, nodes: updatedNodes } })
          .eq("id", workflow.id);

        if (updateError) {
          console.error(`❌ Failed to update "${workflow.name}":`, updateError);
        } else {
          console.log(`✅ Unified nodes for "${workflow.name}" -> [${updatedNodes.map(n => n.type).join(", ")}]`);
        }
      } else {
        console.log(`⚪ Already unified: "${workflow.name}"`);
      }
    }
  }

  console.log("✨ Global Node Type Unification Complete!");
}

fixAllNodes();
