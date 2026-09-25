import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../shared/lib/cn';
import { categorySectionId } from '../anchors';

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Yapışkan kategori çubuğu. Kaydırılırken ekranın ortasındaki kategori
 * vurgulanır; dokunulan kategoriye yumuşak kaydırmayla gidilir.
 */
export function CategoryNav({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}): JSX.Element {
  const [activeId, setActiveId] = useState(categories[0]?.id);
  const tabs = useRef(new Map<string, HTMLAnchorElement>());

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible === undefined) return;
        const id = visible.target.id.replace('kategori-', '');
        setActiveId(id);
        const tab = tabs.current.get(id);
        if (typeof tab?.scrollIntoView === 'function') {
          tab.scrollIntoView({ block: 'nearest', inline: 'center' });
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    for (const category of categories) {
      const section = document.getElementById(categorySectionId(category.id));
      if (section !== null) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [categories]);

  return (
    <nav aria-label="Kategoriler" className="sticky top-0 z-20 border-b border-line bg-canvas">
      <div className="scrollbar-quiet mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 sm:px-4">
        {categories.map((category) => {
          const active = category.id === activeId;
          return (
            <a
              key={category.id}
              ref={(element) => {
                if (element === null) tabs.current.delete(category.id);
                else tabs.current.set(category.id, element);
              }}
              href={`#${categorySectionId(category.id)}`}
              aria-current={active ? 'true' : undefined}
              onClick={(event) => {
                const section = document.getElementById(categorySectionId(category.id));
                if (section === null || typeof section.scrollIntoView !== 'function') return;
                event.preventDefault();
                setActiveId(category.id);
                section.scrollIntoView({
                  behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                  block: 'start',
                });
              }}
              className={cn(
                'flex min-h-touch shrink-0 items-center border-b-2 px-3 text-[15px] font-semibold transition-colors',
                active
                  ? 'border-primary text-ink'
                  : 'border-transparent text-ink-secondary hover:text-ink',
              )}
            >
              {category.name}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
