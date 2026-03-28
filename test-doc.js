const doc = {
  clientContent: {
    turns: [
      {
        role: "user",
        parts: [{ text: "Hello" }]
      }
    ],
    turnComplete: true
  }
};
console.log(JSON.stringify(doc, null, 2));
