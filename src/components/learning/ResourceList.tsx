import { useTranslation } from 'react-i18next';
import type { ModuleResource } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';

interface ResourceListProps {
  resources: ModuleResource[];
}

const BUCKET = 'module-resources';

function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function ResourceList({ resources }: ResourceListProps) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const visible = resources
    .filter((r) => r.visibility === 'visible' && r.resource_type !== 'video')
    .sort((a, b) => a.display_order - b.display_order);

  if (visible.length === 0) return null;

  return (
    <div className="space-y-4">
      {visible.map((r) => {
        const title = isAr ? r.title_ar : r.title_en;
        const url = r.storage_path ? publicUrl(r.storage_path) : null;

        if (r.resource_type === 'pdf' && url) {
          return (
            <div key={r.id} className="card">
              <p className="font-medium mb-2">{title}</p>
              {/* PDF opens inline without forcing a download, per SRS §26 */}
              <iframe src={url} title={title} className="w-full h-[500px] rounded-control border" />
            </div>
          );
        }

        if ((r.resource_type === 'poster' || r.resource_type === 'image') && url) {
          return (
            <div key={r.id} className="card">
              <p className="font-medium mb-2">{title}</p>
              <img src={url} alt={title} className="w-full rounded-control" />
            </div>
          );
        }

        if (r.resource_type === 'external_link' && r.storage_path) {
          return (
            <a key={r.id} href={r.storage_path} target="_blank" rel="noreferrer" className="card block hover:shadow-cardHover">
              <p className="font-medium text-brand-600 underline">{title}</p>
            </a>
          );
        }

        // 'file' type — downloadable, no inline preview
        return (
          <a key={r.id} href={url ?? '#'} download className="card flex items-center justify-between hover:shadow-cardHover">
            <p className="font-medium">{title}</p>
            <span className="text-sm text-brand-600">Download</span>
          </a>
        );
      })}
    </div>
  );
}
