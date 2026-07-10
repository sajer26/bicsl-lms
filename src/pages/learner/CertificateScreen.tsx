import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { AppHeader } from '@/components/layout/AppHeader';
import type { Certificate, Course } from '@/lib/types';

export default function CertificateScreen() {
  const { profile } = useAuth();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('certificates')
      .select('*')
      .eq('learner_id', profile.id)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        setCertificate(data as Certificate | null);
        if (data) {
          const { data: courseData } = await supabase.from('courses').select('*').eq('id', data.course_id).single();
          setCourse(courseData as Course);
        }
        setLoading(false);
      });
  }, [profile]);

  async function downloadPdf() {
    if (!certRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`BICSL-Certificate-${profile?.full_name ?? 'learner'}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-50">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <p className="text-center text-ink/50">Loading...</p>
        ) : !certificate ? (
          <div className="card text-center text-ink/60">
            Complete all seven BICSL modules to receive your certificate.
          </div>
        ) : (
          <>
            <div ref={certRef} className="bg-white border-8 border-brand-500 rounded-card p-10 text-center space-y-4">
              <p className="text-brand-500 font-semibold tracking-widest text-sm">CERTIFICATE OF COMPLETION</p>
              <h1 className="text-3xl font-bold text-brand-800">{profile?.full_name}</h1>
              <p className="text-ink/70">has successfully completed</p>
              <h2 className="text-xl font-semibold">{course?.name_en}</h2>
              <div className="flex justify-center gap-10 text-sm text-ink/60 pt-4">
                <div>
                  <p className="font-medium text-ink">Completion Date</p>
                  <p>{new Date(certificate.issued_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-medium text-ink">Expiry Date</p>
                  <p>{new Date(certificate.expires_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button onClick={downloadPdf} disabled={downloading} className="btn-primary">
                {downloading ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>

            <div className="card bg-warning-bg text-warning text-sm">
              Please contact the Infection Prevention and Control Department if your organization
              requires completion of the practical competency assessment (e.g., Fit Test).
            </div>
          </>
        )}
      </main>
    </div>
  );
}
