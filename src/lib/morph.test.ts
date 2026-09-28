// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { morphInto } from './morph';

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById('root')!;
});

describe('morphInto', () => {
  it('ends with exactly the rendered markup', () => {
    root.innerHTML = '<p class="a">One <b>1</b></p><ul><li>x</li><li>y</li></ul>';
    const html = '<p class="b">Two <b>2</b></p><ul><li>x</li></ul><span>new</span>';
    morphInto(root, html);
    expect(root.innerHTML).toBe(html);
  });

  it('keeps the same element when only text and attributes change', () => {
    root.innerHTML = '<div style="flex-grow:40">₹92,400</div>';
    const before = root.firstElementChild;
    morphInto(root, '<div style="flex-grow:55">₹1,02,000</div>');
    expect(root.firstElementChild).toBe(before);
    expect(root.textContent).toBe('₹1,02,000');
    expect((root.firstElementChild as HTMLElement).style.flexGrow).toBe('55');
  });

  it('does not collapse a panel the reader opened', () => {
    root.innerHTML = '<details><summary>How</summary><p>₹1</p></details>';
    root.querySelector('details')!.open = true;
    morphInto(root, '<details><summary>How</summary><p>₹2</p></details>');
    expect(root.querySelector('details')!.open).toBe(true);
    expect(root.querySelector('p')!.textContent).toBe('₹2');
  });

  it('leaves script-owned elements alone', () => {
    root.innerHTML = '<p data-morph-keep>animating</p><p>plain</p>';
    morphInto(root, '<p data-morph-keep>final</p><p>changed</p>');
    expect(root.children[0].textContent).toBe('animating');
    expect(root.children[1].textContent).toBe('changed');
  });

  it('replaces a subtree whose shape changed', () => {
    root.innerHTML = '<table><tbody><tr><td>1</td></tr></tbody></table>';
    morphInto(root, '<div role="alert">Does not add up</div>');
    expect(root.innerHTML).toBe('<div role="alert">Does not add up</div>');
  });

  it('removes attributes that are no longer rendered', () => {
    root.innerHTML = '<p hidden class="x">a</p>';
    morphInto(root, '<p class="x">a</p>');
    expect(root.firstElementChild!.hasAttribute('hidden')).toBe(false);
  });
});
