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

async function fixTemplates() {
  console.log("🚀 Starting Template Node Type Fix...");

  const { data: templates, error: fetchError } = await supabaseAdmin
    .from("workflows")
    .select("*")
    .eq("is_template", true);

  if (fetchError) {
    console.error("❌ Failed to fetch templates:", fetchError);
    return;
  }

  console.log(`🔍 Found ${templates?.length} templates to process.`);

  for (const template of templates || []) {
    let canvas = template.canvas_json;
    if (typeof canvas === 'string') {
      canvas = JSON.parse(canvas);
    }

    if (canvas && canvas.nodes) {
      const updatedNodes = canvas.nodes.map((node) => ({
        ...node,
        type: node.type === "agent" ? "AgentNode" : (node.type === "human" ? "HITLNode" : node.type)
      }));

      const { error: updateError } = await supabaseAdmin
        .from("workflows")
        .update({ canvas_json: { ...canvas, nodes: updatedNodes } })
        .eq("id", template.id);

      if (updateError) {
        console.error(`❌ Failed to update template "${template.name}":`, updateError);
      } else {
        console.log(`✅ Updated template "${template.name}"`);
      }
    }
  }

  console.log("✨ Template Node Type Fix Complete!");
}

fixTemplates();
