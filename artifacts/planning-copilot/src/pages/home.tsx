import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useListProjects, 
  useCreateProject, 
  useDeleteProject,
  useGetProjectSummary,
  useListTemplates
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Briefcase, MapPin, Loader2, Plus, ArrowRight, Trash2, LayoutTemplate } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useListProjects();
  const { data: templates } = useListTemplates();
  const createProject = useCreateProject();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    projectType: "EPC",
    industry: "Oil & Gas",
    location: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    targetFinishDate: format(new Date(new Date().setMonth(new Date().getMonth() + 12)), "yyyy-MM-dd"),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createProject.mutate(
      { data: formData },
      {
        onSuccess: (newProject) => {
          setIsCreateOpen(false);
          setLocation(`/projects/${newProject.id}`);
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col">
      <div className="max-w-6xl mx-auto w-full flex-grow space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">Planning Copilot</h1>
            <p className="text-slate-500 mt-2 text-lg">AI-powered scheduling and project controls</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 font-semibold">
                <Plus className="h-5 w-5" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Define the core parameters for your new schedule.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input 
                    id="name" 
                    value={formData.name}
                    onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Refinery Expansion Phase 2" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Input 
                    id="desc" 
                    value={formData.description}
                    onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief overview..." 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Project Type</Label>
                    <Input 
                      id="type" 
                      value={formData.projectType}
                      onChange={(e) => setFormData(f => ({ ...f, projectType: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input 
                      id="industry" 
                      value={formData.industry}
                      onChange={(e) => setFormData(f => ({ ...f, industry: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input 
                    id="location" 
                    value={formData.location}
                    onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">Start Date</Label>
                    <Input 
                      id="start" 
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(f => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">Target Finish</Label>
                    <Input 
                      id="end" 
                      type="date"
                      value={formData.targetFinishDate}
                      onChange={(e) => setFormData(f => ({ ...f, targetFinishDate: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Initialize Project
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="flex flex-col">
                <CardHeader>
                  <Skeleton className="h-6 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-1/3" />
                </CardHeader>
                <CardContent className="flex-grow">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !projects?.length ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-white">
            <Briefcase className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No projects yet</h3>
            <p className="mt-2 text-sm text-slate-500">Get started by creating a new project schedule.</p>
            <Button className="mt-6" onClick={() => setIsCreateOpen(true)}>
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onClick={() => setLocation(`/projects/${project.id}`)} />
            ))}
          </div>
        )}

        {templates && templates.length > 0 && (
          <div className="mt-12 space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-blue-500" />
              Schedule Templates
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {templates.map(template => (
                <Card key={template.id} className="bg-white border-slate-200">
                  <CardHeader className="p-4">
                    <Badge variant="outline" className="w-fit mb-2 text-[10px] bg-blue-50 text-blue-700 border-blue-200">{template.category}</Badge>
                    <CardTitle className="text-sm">{template.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2 mt-1">{template.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: any, onClick: () => void }) {
  const queryClient = useQueryClient();
  const deleteProject = useDeleteProject();

  const { data: summary } = useGetProjectSummary(project.id, {
    query: {
      enabled: !!project.id,
      queryKey: [`/api/projects/${project.id}/summary`]
    }
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
      deleteProject.mutate({ projectId: project.id }, {
        onSuccess: () => {
          toast.success("Project deleted");
          queryClient.invalidateQueries({ queryKey: [`/api/projects`] });
        }
      });
    }
  };

  return (
    <Card 
      className="flex flex-col hover:border-blue-500 hover:shadow-md transition-all cursor-pointer bg-white group relative"
      onClick={onClick}
    >
      <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <Badge variant={project.status === "active" ? "default" : "secondary"}>
            {project.status}
          </Badge>
          <span className="text-xs text-slate-400 font-mono pr-8">ID: {project.id}</span>
        </div>
        <CardTitle className="text-xl line-clamp-1 pr-8">{project.name}</CardTitle>
        <CardDescription className="line-clamp-2 min-h-[40px]">
          {project.description || "No description provided."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="truncate max-w-[120px]">{project.location || "N/A"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-slate-400" />
            <span className="truncate max-w-[100px]">{project.industry || "N/A"}</span>
          </div>
        </div>

        {summary && (
          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <span className="text-slate-500">Tasks</span>
              <span className="font-semibold text-slate-900">{summary.totalTasks}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500">Completion</span>
              <span className="font-semibold text-slate-900">{summary.completionPercentage.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-slate-50 py-3 mt-auto border-t">
        <div className="flex items-center text-sm font-medium text-blue-600 w-full">
          Open Workspace
          <ArrowRight className="ml-auto h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </div>
      </CardFooter>
    </Card>
  );
}
