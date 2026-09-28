/**
 * Updates a live DOM tree to match freshly rendered HTML, touching only what changed.
 *
 * The result is re-rendered from scratch on every keystroke. Swapping innerHTML would be simpler,
 * but it throws away state the reader owns (an expanded "How the tax was worked out" panel) and
 * restarts every element, so nothing can transition from its old value to its new one. Patching
 * in place keeps both.
 *
 * The matching is positional, which is right here: both trees come from the same template, so
 * their shapes only diverge when a whole section appears or disappears, and then that subtree is
 * simply replaced.
 */

/** Elements with this attribute belong to script (the animated figure, the change chip). */
const KEEP = 'data-morph-keep';

/** Attributes the reader controls, which a re-render must not reset. */
const READER_STATE: Record<string, string[]> = { DETAILS: ['open'] };

export function morph(current: Node, next: Node): void {
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) {
    current.parentNode?.replaceChild(next, current);
    return;
  }

  if (current.nodeType !== Node.ELEMENT_NODE) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }

  const from = current as Element;
  const to = next as Element;
  if (from.hasAttribute(KEEP)) return;

  syncAttributes(from, to);

  // Snapshot both child lists first: moving a node out of `to` shrinks its live list.
  const oldChildren = Array.from(from.childNodes);
  const newChildren = Array.from(to.childNodes);
  const shared = Math.min(oldChildren.length, newChildren.length);

  for (let i = 0; i < shared; i++) morph(oldChildren[i], newChildren[i]);
  for (let i = shared; i < oldChildren.length; i++) from.removeChild(oldChildren[i]);
  for (let i = shared; i < newChildren.length; i++) from.appendChild(newChildren[i]);
}

function syncAttributes(from: Element, to: Element): void {
  const kept = READER_STATE[from.nodeName] ?? [];
  for (const { name } of Array.from(from.attributes)) {
    if (!to.hasAttribute(name) && !kept.includes(name)) from.removeAttribute(name);
  }
  for (const { name, value } of Array.from(to.attributes)) {
    if (kept.includes(name)) continue;
    if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  }
}

/** Patches `container`'s children to match `html`. */
export function morphInto(container: Element, html: string): void {
  const template = container.ownerDocument.createElement('template');
  template.innerHTML = html;
  const next = container.cloneNode(false) as Element;
  next.append(template.content);
  morph(container, next);
}
