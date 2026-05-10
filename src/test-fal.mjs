import { fal } from "@fal-ai/client";

fal.config({
  credentials: "9182cf92-31eb-4bca-96a7-8221ebaf7634:c19b3bcedf24eb7981e2dd5584217298"
});

async function main() {
  try {
    const res = await fal.subscribe("fal-ai/kling-video/v1.6/standard/text-to-video", {
      input: { prompt: "A dog running", duration: "5" },
    });
    console.log(res);
  } catch(e) {
    console.error(e.message);
  }
}
main();
