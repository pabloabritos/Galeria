async function loadSponsorBanners() {
  const slots = document.querySelectorAll("[data-banner-slot]");
  if (!slots.length) return;

  await Promise.all([...slots].map(async (slot) => {
    const placement = slot.dataset.bannerSlot || "home";
    try {
      const response = await fetch(`/api/banners?placement=${encodeURIComponent(placement)}`);
      if (!response.ok) throw new Error("No se pudieron cargar banners");
      const banners = await response.json();

      if (!banners.length) {
        slot.hidden = true;
        return;
      }

      slot.hidden = false;
      // Mostrar el section padre si estaba oculto (ej: #channel-promo-section)
      const parentSection = slot.closest("section[id]");
      if (parentSection && parentSection.style.display === "none") {
        parentSection.style.display = "";
      }
      const isVerticalSlot = placement.includes("vertical");
      slot.innerHTML = banners.map((banner) => {
        const sponsorLabel = banner.sponsor
          ? `Publicidad · ${escapeHtml(banner.sponsor)}`
          : "Publicidad";
        return `
        <a class="sponsor-banner ${isVerticalSlot ? "is-vertical" : ""}"
           href="${escapeHtml(banner.linkUrl)}"
           target="_blank" rel="noopener sponsored"
           aria-label="${sponsorLabel}">
          ${banner.imageUrl
            ? `<span class="sponsor-banner-media">
                 <img src="${escapeHtml(banner.imageUrl)}"
                      alt="${escapeHtml(banner.sponsor || banner.title || "Sponsor")}"
                      loading="lazy" />
               </span>`
            : ""}
          <span class="sponsor-banner-copy">
            <small>${sponsorLabel}</small>
            <strong>${escapeHtml(banner.title)}</strong>
            ${banner.body ? `<span>${escapeHtml(banner.body)}</span>` : ""}
          </span>
        </a>`;
      }).join("");
    } catch (error) {
      console.error("Error cargando banners:", error);
      slot.hidden = true;
    }
  }));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", loadSponsorBanners);
