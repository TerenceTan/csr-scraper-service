
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { Loader2, FileText, Download, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Home() {
  const [urls, setUrls] = useState("");
  const [urlValidation, setUrlValidation] = useState<{ valid: boolean; invalid: boolean }>({ valid: false, invalid: false });
  const [scrapingMode, setScrapingMode] = useState<"main" | "header" | "footer">("main");

  // Validate URLs when input changes
  const validateUrls = (input: string) => {
    const lines = input.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      setUrlValidation({ valid: false, invalid: false });
      return;
    }

    const urlPattern = /^https?:\/\/.+/;
    const allValid = lines.every(line => urlPattern.test(line.trim()));
    const someInvalid = lines.some(line => !urlPattern.test(line.trim()));

    setUrlValidation({ valid: allValid, invalid: someInvalid });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setUrls(value);
    validateUrls(value);
  };
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

  const deleteJobMutation = trpc.scraping.deleteJob.useMutation({
    onSuccess: () => {
      toast.success("Job deleted successfully");
      jobsQuery.refetch();
    },
    onError: (error) => {
      toast.error("Failed to delete job: " + error.message);
    },
  });

  const handleDeleteJob = (e: React.MouseEvent, jobId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this job?")) {
      deleteJobMutation.mutate({ jobId });
    }
  };

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

    startJobMutation.mutate({ urls: urlList, scrapingMode });
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
              <div className="relative">
                <Textarea
                  placeholder="https://example.com&#10;https://example.com/about&#10;https://example.com/products"
                  value={urls}
                  onChange={handleUrlChange}
                  rows={8}
                  className={`font-mono text-sm pr-10 ${urlValidation.invalid ? 'border-red-300 focus:border-red-500' : urlValidation.valid ? 'border-green-300 focus:border-green-500' : ''}`}
                />
                {urlValidation.valid && (
                  <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-green-600" />
                )}
                {urlValidation.invalid && (
                  <XCircle className="absolute top-3 right-3 h-5 w-5 text-red-600" />
                )}
              </div>
              {urlValidation.invalid && (
                <p className="text-sm text-red-600">Some URLs are invalid. Please check the format (must start with http:// or https://)</p>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Scraping Mode:</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="main"
                      checked={scrapingMode === "main"}
                      onChange={(e) => setScrapingMode(e.target.value as "main" | "header" | "footer")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Main Content (default) - Excludes header/footer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="header"
                      checked={scrapingMode === "header"}
                      onChange={(e) => setScrapingMode(e.target.value as "main" | "header" | "footer")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Header Only - Extract repeated headers</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="footer"
                      checked={scrapingMode === "footer"}
                      onChange={(e) => setScrapingMode(e.target.value as "main" | "header" | "footer")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Footer Only - Extract repeated footers</span>
                  </label>
                </div>
              </div>

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
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {getStatusText(job.status)}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => handleDeleteJob(e, job.id)}
                                disabled={deleteJobMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {job.completedUrls} / {job.totalUrls} URLs completed
                            {job.failedUrls > 0 && ` • ${job.failedUrls} failed`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(Number(job.createdAt)).toLocaleString()}
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
