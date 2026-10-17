export function inspectPhoneTimeline(page) {
  return page.locator(".timeline-stop__time").evaluateAll((buttons) => {
    const dotCenters = buttons.map((button) => {
      const node = button.closest(".timeline-stop")?.querySelector(".timeline-stop__node");
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return box.left + box.width / 2;
    });
    return {
      times: buttons.map((button) => ({
        text: button.innerText.trim(),
        clientWidth: button.clientWidth,
        scrollWidth: button.scrollWidth,
      })),
      dotCenters,
    };
  });
}
