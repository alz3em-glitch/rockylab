// Shared by the UI and regression tests. Never award a real-only task locally.
export async function verifyObjectives(level, progress, verify, mode='simulator') {
  const completed=[];
  for (const task of level.tasks) {
    const key=level.id+'-'+task.check;
    if(progress.tasks[key] || (task.real && mode!=='real') || (task.simulatorOnly && mode==='real')) continue;
    if(await verify(task.check)) {
      progress.tasks[key]={at:new Date().toISOString(),mode};
      completed.push(task.title);
    }
  }
  return completed;
}

