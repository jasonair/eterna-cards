
const apiKey = 'AIzaSyA1PBtBRqF_FeZcgws8hUiSiq9vFDAAbFs';
async function list() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.models) {
      console.log("AVAILABLE MODELS:");
      data.models.forEach(m => console.log(` - ${m.name}`));
    } else {
      console.log("No models found or error:", JSON.stringify(data));
    }
  } catch (e) {
    console.log("Fetch error:", e.message);
  }
}
list();
