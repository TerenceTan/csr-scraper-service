
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { Loader2, FileText, Download, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Home() {
  const [urls, setUrls] = useState("");
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  const startJobMutation = trpc.scraping.startJob.useMutation({
    onSuccess: (data) => {
      toast.success("Scraping job started!");
      setActiveJobId(data.jobId);
      setUrls("");
      jobsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to start job: ${error.message}`);
    },
  });

  const jobsQuery = trpc.scraping.listJobs.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5 seconds for job updates
  });

  const handleStartScraping = () => {
    const urlList = urls
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urlList.length === 0) {
      toast.error("Please enter at least one URL");
      return;
    }

    // Validate URLs
    const invalidUrls = urlList.filter((url) => {
      try {
        new URL(url);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      toast.error(`Invalid URLs: ${invalidUrls.join(", ")}`);
      return;
    }

    startJobMutation.mutate({ urls: urlList });
  };



  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{APP_TITLE}</h1>
          <p className="text-gray-600">
            Extract and export website content for translation workflows
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: URL Input */}
          <Card>
            <CardHeader>
              <CardTitle>Start New Scraping Job</CardTitle>
              <CardDescription>
                Enter URLs (one per line) to extract content from client-side rendered pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="https://example.com&#10;https://example.com/about&#10;https://example.com/products"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleStartScraping}
                disabled={startJobMutation.isPending || !urls.trim()}
                className="w-full"
                size="lg"
              >
                {startJobMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Start Scraping
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Right Column: Job List */}
          <Card>
            <CardHeader>
              <CardTitle>Your Scraping Jobs</CardTitle>
              <CardDescription>View and manage your scraping jobs</CardDescription>
            </CardHeader>
            <CardContent>
              {jobsQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : jobsQuery.data && jobsQuery.data.length > 0 ? (
                <div className="space-y-3">
                  {jobsQuery.data
                    .slice()
                    .reverse()
                    .map((job) => (
                      <Link key={job.id} href={`/job/${job.id}`}>
                        <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(job.status)}
                              <span className="font-medium">Job #{job.id}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {getStatusText(job.status)}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {job.completedUrls} / {job.totalUrls} URLs completed
                            {job.failedUrls > 0 && ` • ${job.failedUrls} failed`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(job.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </Link>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No scraping jobs yet</p>
                  <p className="text-sm">Start by entering URLs on the left</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
