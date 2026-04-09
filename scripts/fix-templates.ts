import { supabaseAdmin } from "../lib/supabase";

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
      const updatedNodes = canvas.nodes.map((node: any) => ({
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
