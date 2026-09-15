import {PracticeShell} from './system-shell.js';
import {passesWorkplace} from './workplace.js';
export function prepareLab(id){const s=new PracticeShell();if(id===15)s.run('mkdir -p ~/project\necho incident > ~/project/incident.txt');if(id===17){s.run('touch ~/report.txt\nchmod 640 ~/report.txt\nsudo useradd -m trainee');}if(id===23)s.put('~/health.sh','');s.events.clear();s.history=[];return s;}
export function checkTask(shell,task){return task.check.startsWith('work-')?passesWorkplace(shell,task.check):shell.check(task.check);}
export function enableTrainingModels(levels){
 const related={15:16,16:15,17:8,18:8,19:11,20:16,21:16,22:14,23:6,24:10,25:17,26:18};
 for(const level of levels){level.inspiredBy=[level.lecture||related[level.id]||level.id];for(const task of level.tasks){task.inspiredBy=[task.lecture||level.inspiredBy[0]];task.requiresRealPreviously=!!task.real;task.real=false;task.modelled=true;}for(const q of level.quiz)q.inspiredBy=level.inspiredBy;}
}
export function restoreCompletedLab(level,progress){const s=prepareLab(level.id);for(const task of level.tasks){const done=progress.tasks[level.id+'-'+task.check];if(done?.mode==='simulator')s.run(task.command);}s.events.clear();s.history=[];return s;}

