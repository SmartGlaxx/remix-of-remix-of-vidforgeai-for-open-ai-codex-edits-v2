import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, TrendingUp, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import Sidebar from "@/components/dashboard/Sidebar";

const nicheData = [
  { name: "Ancient Myths & Legends", category: "Education", rpm: 18.36, trend: 45, avgSubs: "1.2M", difficulty: "Medium" },
  { name: "True Crime Deep Dives", category: "Entertainment", rpm: 14.20, trend: 33, avgSubs: "890K", difficulty: "Low" },
  { name: "Science Explained", category: "Education", rpm: 11.50, trend: 19, avgSubs: "2.1M", difficulty: "High" },
  { name: "Fitness Stories", category: "Health", rpm: 8.32, trend: 28, avgSubs: "560K", difficulty: "Low" },
  { name: "Personal Finance", category: "Finance", rpm: 22.10, trend: 52, avgSubs: "1.5M", difficulty: "Medium" },
  { name: "History Uncovered", category: "Education", rpm: 15.80, trend: 38, avgSubs: "780K", difficulty: "Medium" },
  { name: "Space Exploration", category: "Science", rpm: 16.90, trend: 41, avgSubs: "1.8M", difficulty: "Medium" },
  { name: "Psychology Hacks", category: "Education", rpm: 13.40, trend: 27, avgSubs: "950K", difficulty: "Low" },
  { name: "Luxury Lifestyle", category: "Entertainment", rpm: 24.50, trend: 60, avgSubs: "2.4M", difficulty: "High" },
  { name: "Survival Skills", category: "Outdoors", rpm: 9.80, trend: 35, avgSubs: "420K", difficulty: "Low" },
];

const categories = ["All Categories", "Education", "Entertainment", "Finance", "Health", "Science", "Outdoors"];

const difficultyColor = (d: string) => {
  if (d === "Low") return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
  if (d === "Medium") return "text-primary bg-primary/10 border-primary/20";
  return "text-destructive bg-destructive/10 border-destructive/20";
};

const NicheFinder = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");

  const filtered = nicheData.filter((n) => {
    const matchSearch = n.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All Categories" || n.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activePage="niches" />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <h1 className="font-display text-3xl font-bold text-foreground mb-2">Niche Finder</h1>
              <p className="text-muted-foreground mb-8">Discover trending YouTube niches with high RPM potential</p>
            </motion.div>

            {/* Search & Filter */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex gap-4 mb-8"
            >
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search niches..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-11 h-12 bg-card border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-12 pl-10 pr-8 rounded-lg bg-card border border-border text-foreground text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </motion.div>

            {/* Table */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="glass-card overflow-hidden"
            >
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Niche</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">RPM</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trend</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Subs</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Difficulty</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((niche, i) => (
                    <motion.tr
                      key={niche.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <TrendingUp className="w-4 h-4 text-primary/60" />
                          <span className="font-medium text-foreground">{niche.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-3 py-1 rounded-full text-xs bg-secondary text-secondary-foreground border border-border">
                          {niche.category}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right font-display font-bold text-foreground">${niche.rpm.toFixed(2)}</td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-emerald-400 font-semibold text-sm">+{niche.trend}%</span>
                      </td>
                      <td className="px-6 py-5 text-right text-muted-foreground text-sm">{niche.avgSubs} avg</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${difficultyColor(niche.difficulty)}`}>
                          {niche.difficulty}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-16 text-center text-muted-foreground">No niches found matching your search.</div>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NicheFinder;
