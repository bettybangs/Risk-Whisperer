(function () {
  var $ = function (id) { return document.getElementById(id); };
  var last = null; // { original, translation } of the latest successful run

  function show(el, on) { el.hidden = !on; }
  function setError(msg) { $("error").textContent = msg || ""; show($("error"), !!msg); }

  // Build DOM with textContent only, so model output can never inject markup.
  function paragraphs(container, text) {
    container.textContent = "";
    String(text).split(/\n{2,}/).forEach(function (chunk) {
      var p = document.createElement("p");
      p.textContent = chunk;
      container.appendChild(p);
    });
  }

  async function post(path, body) {
    var res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error((data.error && data.error.message) || "Something went wrong. Please try again.");
    return data;
  }

  $("text").addEventListener("input", function () {
    $("count").textContent = $("text").value.length.toLocaleString("en-US") + " / 20,000";
  });

  $("industry").addEventListener("change", function () {
    show($("industryNote"), $("industry").value === "Healthcare education");
  });

  $("go").addEventListener("click", async function () {
    var text = $("text").value;
    if (!text.trim()) { setError("Paste some text first."); return; }
    setError("");
    $("go").disabled = true; $("go").textContent = "Translating...";
    show($("verifyOut"), false);
    try {
      var d = await post("/api/translate", {
        text: text, audience: $("audience").value, mode: $("mode").value, length: $("length").value, industry: $("industry").value
      });
      var summaryOnly = $("length").value === "Summary only";
      $("summary").textContent = d.summary;
      paragraphs($("original"), text);
      paragraphs($("plain"), d.plain);
      show($("cols"), !summaryOnly);
      show($("verify"), true);
      show($("copy"), !summaryOnly);
      $("flags").textContent = "";
      d.flags.forEach(function (f) { var li = document.createElement("li"); li.textContent = f; $("flags").appendChild(li); });
      show($("flagsBox"), d.flags.length > 0);
      $("glossary").textContent = "";
      d.glossary.forEach(function (g) {
        var dt = document.createElement("dt"), dd = document.createElement("dd");
        dt.textContent = g.term; dd.textContent = g.meaning;
        $("glossary").appendChild(dt); $("glossary").appendChild(dd);
      });
      show($("glossaryBox"), d.glossary.length > 0);
      // The verifier checks everything the reader sees: summary, body, and glossary.
      var checkText = "SUMMARY:\n" + d.summary + (d.plain ? "\n\nTRANSLATION:\n" + d.plain : "") +
        (d.glossary.length ? "\n\nGLOSSARY:\n" + d.glossary.map(function (g) { return g.term + ": " + g.meaning; }).join("\n") : "");
      last = { original: text, plain: d.plain, checkText: checkText, industry: $("industry").value };
      show($("results"), true);
    } catch (e) {
      setError(e.message);
    } finally {
      $("go").disabled = false; $("go").textContent = "Translate";
    }
  });

  $("verify").addEventListener("click", async function () {
    if (!last) return;
    setError("");
    $("verify").disabled = true; $("verify").textContent = "Checking...";
    try {
      var d = await post("/api/verify", { original: last.original, translation: last.checkText, industry: last.industry });
      var box = $("verifyOut");
      box.textContent = "";
      var v = document.createElement("div");
      v.className = "verdict " + (d.faithful ? "ok" : "bad");
      var meaning = d.issues.filter(function (i) { return i.impact === "meaning"; }).length;
      var context = d.issues.length - meaning;
      var summary = d.faithful ? "No dropped or changed meaning found." : meaning + " possible change(s) to meaning found. Review before relying on this translation.";
      if (context > 0) summary += " " + context + " added explanation(s) the original does not contain (usually fine, but check you are happy with them).";
      v.textContent = summary;
      d.issues.forEach(function (i) {
        var div = document.createElement("div"); div.className = "issue " + i.impact;
        var head = document.createElement("strong");
        head.textContent = i.impact === "meaning" ? "Meaning, " + i.type + ": " + i.detail : "Added explanation: " + i.detail;
        div.appendChild(head);
        [["Original", i.original], ["Translation", i.translation]].forEach(function (pair) {
          if (!pair[1]) return;
          var q = document.createElement("q"); q.textContent = pair[0] + ": " + pair[1]; div.appendChild(q);
        });
        v.appendChild(div);
      });
      box.appendChild(v);
      show(box, true);
    } catch (e) {
      setError(e.message);
    } finally {
      $("verify").disabled = false; $("verify").textContent = "Check for dropped or changed meaning";
    }
  });

  $("copy").addEventListener("click", function () {
    if (!last) return;
    navigator.clipboard.writeText(last.plain || "").then(function () {
      $("copy").textContent = "Copied";
      setTimeout(function () { $("copy").textContent = "Copy translation"; }, 1500);
    }).catch(function () { setError("Could not copy. Select the text and copy it manually."); });
  });
})();
