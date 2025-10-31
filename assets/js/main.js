document.addEventListener("DOMContentLoaded", () => {
    const checkBtn = document.getElementById("check-btn");
    const locationInput = document.getElementById("location-input");
    const panel = document.getElementById("condition-panel");
    const weeklyCards = document.getElementById("weekly-cards");

    // 假資料：本週推薦
    const weekly = [
        {
            title: "週五｜新竹五指山",
            desc: "雲量低、東南向視野佳，可拍銀河尾段",
        },
        {
            title: "週六｜苗栗泰安",
            desc: "光害低，適合拍星軌＋前景",
        },
        {
            title: "下週一｜宜蘭太平山",
            desc: "高海拔＋低溫乾冷，適合深空",
        },
    ];

    weeklyCards.innerHTML = weekly
        .map(
            (item) => `
      <article class="card">
        <h3>${item.title}</h3>
        <p>${item.desc}</p>
      </article>
    `
        )
        .join("");

    checkBtn?.addEventListener("click", async () => {
        const loc = locationInput.value.trim() || "新竹";
        // TODO: 這裡之後改成真的 API 呼叫（氣象 + 月相 + 光害）
        panel.querySelector(".status").textContent = `${loc} 今晚勉強可拍`;
        const list = panel.querySelectorAll(".status-list li");
        list[0].textContent = "雲量：40%（有飄雲）";
        list[1].textContent = "光害：Bortle 5（建議上山）";
        list[2].textContent = "月相：下弦月（前半夜會干擾）";
        list[3].textContent = "建議拍攝：彗星 / 星軌 / 夜景合成";
    });
});
