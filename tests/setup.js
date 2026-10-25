// jsdom has no native dialog UI. These shims only model its open/close state;
// focus trapping, geometry and real clipboard permissions require browser QA.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
window.matchMedia ||= query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} }
