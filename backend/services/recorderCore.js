/**
 * Recorder pieces used by the local CLI (scripts/record.js):
 *
 * pageRecorder runs inside the page and reports interactions through the
 * `__catiRecord` binding. addStep merges them into session.steps.
 */

// Runs inside the page. Must be self-contained (serialised to a string).
export function pageRecorder() {
    if (window.__catiRecorderInstalled) return;
    window.__catiRecorderInstalled = true;

    const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'));
    const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

    function roleOf(el) {
        const explicit = el.getAttribute('role');
        if (explicit) return explicit;
        const tag = el.tagName.toLowerCase();
        if (tag === 'button') return 'button';
        if (tag === 'a' && el.hasAttribute('href')) return 'link';
        if (tag === 'input') {
            const t = (el.getAttribute('type') || 'text').toLowerCase();
            if (['button', 'submit', 'reset'].includes(t)) return 'button';
            if (t === 'checkbox') return 'checkbox';
            if (t === 'radio') return 'radio';
        }
        return null;
    }

    function labelOf(el) {
        if (el.labels && el.labels.length) return clean(el.labels[0].textContent);
        const aria = el.getAttribute('aria-label');
        if (aria) return clean(aria);
        return '';
    }

    function cssPath(el) {
        if (el.id) return '#' + esc(el.id);
        const parts = [];
        let node = el;
        while (node && node.nodeType === 1 && parts.length < 5 && node.tagName !== 'BODY') {
            let part = node.tagName.toLowerCase();
            if (node.id) {
                parts.unshift('#' + esc(node.id));
                break;
            }
            const parent = node.parentElement;
            if (parent) {
                const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
                if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
            }
            parts.unshift(part);
            node = parent;
        }
        return parts.join(' > ');
    }

    function locate(el) {
        const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-test');
        if (testId) return { strategy: 'testId', value: testId };
        const tag = el.tagName.toLowerCase();
        const isField = ['input', 'textarea', 'select'].includes(tag);
        if (isField) {
            const label = labelOf(el);
            if (label && !['button', 'submit', 'reset'].includes((el.type || '').toLowerCase())) {
                return { strategy: 'label', value: label };
            }
            if (el.id) return { strategy: 'css', value: '#' + esc(el.id) };
            if (el.name) return { strategy: 'css', value: tag + '[name="' + el.name + '"]' };
            const ph = el.getAttribute('placeholder');
            if (ph) return { strategy: 'css', value: tag + '[placeholder="' + ph + '"]' };
        }
        const role = roleOf(el);
        const name = clean(el.getAttribute('aria-label') || el.value || el.textContent);
        if (role && name && name.length <= 60) return { strategy: 'role', role, value: name };
        if (name && name.length <= 40 && !isField) return { strategy: 'text', value: name };
        return { strategy: 'css', value: cssPath(el) };
    }

    function target(event) {
        let el = event.target;
        if (!(el instanceof Element)) return null;
        // Prefer the interactive ancestor (e.g. span inside a button).
        const interactive = el.closest('button, a[href], [role="button"], [role="link"], [role="menuitem"], [role="tab"], input, select, textarea, label');
        if (interactive) el = interactive;
        // Clicking a <label> acts on its control; the control reports itself.
        if (el.tagName === 'LABEL' && el.control) return null;
        return el;
    }

    const send = (step) => {
        try { window.__catiRecord(step); } catch { /* binding not ready */ }
    };

    document.addEventListener('click', (event) => {
        if (!event.isTrusted) return;
        const el = target(event);
        if (!el) return;
        const tag = el.tagName.toLowerCase();
        // Typing targets are recorded through 'input'/'change'.
        if (tag === 'select' || tag === 'textarea') return;
        if (tag === 'input') {
            const t = (el.type || 'text').toLowerCase();
            if (!['button', 'submit', 'reset', 'checkbox', 'radio'].includes(t)) return;
        }
        send({ kind: 'click', locator: locate(el) });
    }, true);

    document.addEventListener('input', (event) => {
        if (!event.isTrusted) return;
        const el = event.target;
        if (!(el instanceof Element)) return;
        const tag = el.tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') return;
        const t = (el.type || 'text').toLowerCase();
        if (['checkbox', 'radio', 'button', 'submit', 'file'].includes(t)) return;
        send({ kind: 'fill', locator: locate(el), value: el.value });
    }, true);

    document.addEventListener('change', (event) => {
        if (!event.isTrusted) return;
        const el = event.target;
        if (!(el instanceof HTMLSelectElement)) return;
        const opt = el.selectedOptions[0];
        send({ kind: 'select', locator: locate(el), value: clean(opt ? opt.textContent : el.value) });
    }, true);

    document.addEventListener('keydown', (event) => {
        if (!event.isTrusted || event.key !== 'Enter') return;
        const el = event.target;
        if (!(el instanceof Element) || el.tagName.toLowerCase() !== 'input') return;
        send({ kind: 'press', locator: locate(el), value: 'Enter' });
    }, true);
}

export function addStep(session, step) {
    const last = session.steps[session.steps.length - 1];
    // Collapse keystrokes: consecutive fills on the same field keep only the latest value.
    if (
        step.kind === 'fill' && last && last.kind === 'fill' &&
        last.locator.strategy === step.locator.strategy &&
        last.locator.value === step.locator.value
    ) {
        last.value = step.value;
        return;
    }
    // Drop duplicate clicks fired within the same instant (label/control pairs).
    if (
        step.kind === 'click' && last && last.kind === 'click' &&
        JSON.stringify(last.locator) === JSON.stringify(step.locator) &&
        Date.now() - session.lastAt < 150
    ) {
        return;
    }
    session.steps.push(step);
    session.lastAt = Date.now();
}
