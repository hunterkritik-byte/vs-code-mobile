#include <jni.h>
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <sys/ioctl.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include <atomic>
#include <stdlib.h>
struct PtySession { int master; pid_t child; std::atomic<bool> running; };
static PtySession* session(jlong h){return reinterpret_cast<PtySession*>(h);}
static void resize_fd(int fd,int cols,int rows){struct winsize ws{};ws.ws_col=(unsigned short)(cols>0?cols:80);ws.ws_row=(unsigned short)(rows>0?rows:24);ioctl(fd,TIOCSWINSZ,&ws);}
extern "C" JNIEXPORT jlong JNICALL Java_dev_hunterkritik_vsmobile_terminal_pty_PtyBridge_start(JNIEnv* env,jclass,jstring cwd,jstring home,jstring path,jstring term,jint cols,jint rows){
const char* c=env->GetStringUTFChars(cwd,nullptr);const char* h=env->GetStringUTFChars(home,nullptr);const char* p=env->GetStringUTFChars(path,nullptr);const char* t=env->GetStringUTFChars(term,nullptr);
int m=posix_openpt(O_RDWR|O_NOCTTY|O_CLOEXEC);if(m<0||grantpt(m)!=0||unlockpt(m)!=0){if(m>=0)close(m);return 0;}char* sn=ptsname(m);if(!sn){close(m);return 0;}pid_t child=fork();if(child<0){close(m);return 0;}
if(child==0){setsid();int s=open(sn,O_RDWR);if(s<0)_exit(127);ioctl(s,TIOCSCTTY,0);dup2(s,0);dup2(s,1);dup2(s,2);if(s>2)close(s);setenv("HOME",h,1);setenv("PATH",p,1);setenv("TERM",t,1);setenv("VSMOBILE_ROOT",h,1);chdir(c);execl("/system/bin/sh","sh","-i",(char*)nullptr);_exit(127);}
resize_fd(m,cols,rows);auto* x=new PtySession{m,child,true};env->ReleaseStringUTFChars(cwd,c);env->ReleaseStringUTFChars(home,h);env->ReleaseStringUTFChars(path,p);env->ReleaseStringUTFChars(term,t);return reinterpret_cast<jlong>(x);}
extern "C" JNIEXPORT jint JNICALL Java_dev_hunterkritik_vsmobile_terminal_pty_PtyBridge_write(JNIEnv* env,jclass,jlong handle,jbyteArray data){auto*s=session(handle);if(!s||!s->running)return -1;jsize len=env->GetArrayLength(data);if(len>16384)return -2;jbyte*b=env->GetByteArrayElements(data,nullptr);ssize_t n=write(s->master,b,len);env->ReleaseByteArrayElements(data,b,JNI_ABORT);return n<0?-errno:(jint)n;}
extern "C" JNIEXPORT jboolean JNICALL Java_dev_hunterkritik_vsmobile_terminal_pty_PtyBridge_resize(JNIEnv*,jclass,jlong handle,jint cols,jint rows){auto*s=session(handle);if(!s||!s->running)return JNI_FALSE;resize_fd(s->master,cols,rows);kill(-s->child,SIGWINCH);return JNI_TRUE;}
extern "C" JNIEXPORT jint JNICALL Java_dev_hunterkritik_vsmobile_terminal_pty_PtyBridge_stop(JNIEnv*,jclass,jlong handle){auto*s=session(handle);if(!s)return -1;s->running=false;kill(-s->child,SIGHUP);kill(s->child,SIGTERM);int st=0;waitpid(s->child,&st,0);close(s->master);int code=WIFEXITED(st)?WEXITSTATUS(st):128+WTERMSIG(st);delete s;return code;}
extern "C" JNIEXPORT jbyteArray JNICALL Java_dev_hunterkritik_vsmobile_terminal_pty_PtyBridge_read(JNIEnv* env,jclass,jlong handle,jint maxBytes){
auto*s=session(handle);if(!s||!s->running)return nullptr;int max=maxBytes>0&&maxBytes<=16384?maxBytes:8192;unsigned char buf[16384];ssize_t n=read(s->master,buf,max);
if(n<=0){if(errno==EIO||errno==EPIPE){s->running=false;}return nullptr;}jbyteArray out=env->NewByteArray((jsize)n);env->SetByteArrayRegion(out,0,(jsize)n,reinterpret_cast<jbyte*>(buf));return out;}
