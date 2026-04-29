
const apiKey = 'AIzaSyA1PBtBRqF_FeZcgws8hUiSiq9vFDAAbFs';
const models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.0-flash-exp', 'gemini-1.5-pro'];
const versions = ['v1', 'v1beta'];

async function test() {
  for (const v of versions) {
    for (const m of models) {
      const url = `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${apiKey}`;
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] })
        });
        console.log(`${v} | ${m} => ${resp.status} ${resp.statusText}`);
      } catch (e) {
        console.log(`${v} | ${m} => ERROR: ${e.message}`);
      }
    }
  }
}

test();
