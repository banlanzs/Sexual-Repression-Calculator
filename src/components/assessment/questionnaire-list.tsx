/**
 * 问卷列表组件 - 以列表形式显示所有问卷题目
 * 提供完整的题目概览和横向选项布局
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, ArrowLeft, ArrowRight, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { Question, Response, Demographics } from '@/types';
import { 
  ALL_SCALES, 
  QUICK_ASSESSMENT_SCALES, 
  FULL_ASSESSMENT_SCALES,
  getAdaptiveScales,
  getAdaptiveFullScales,
  isMinor,
  isInexperienced,
  getUserGroupDescription
} from '@/lib/scales';

interface QuestionnaireListProps {
  type: 'quick' | 'full';
  demographics: Demographics;
  responses: Response[];
  onResponseUpdate: (responses: Response[]) => void;
  onComplete: () => void;
  onBack?: () => void;
}

export function QuestionnaireList({
  type,
  demographics,
  responses,
  onResponseUpdate,
  onComplete,
  onBack
}: QuestionnaireListProps) {
  // 根据用户特征选择适应性量表
  const getScalesForUser = () => {
    if (type === 'quick') {
      return getAdaptiveScales(demographics);
    } else {
      return getAdaptiveFullScales(demographics);
    }
  };

  const scaleIds = getScalesForUser();
  const userGroup = getUserGroupDescription(demographics);
  
  // 显示选中的量表信息
  console.log(`用户群体: ${userGroup}, 选中量表:`, scaleIds);
  const allQuestions = scaleIds.flatMap(scaleId => {
    const scale = ALL_SCALES[scaleId];
    return scale ? scale.questions : [];
  });

  const [scrollToQuestionId, setScrollToQuestionId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // 自动保存功能 - 使用debounced保存避免频繁操作
  useEffect(() => {
    if (responses.length > 0) {
      const saveTimer = setTimeout(() => {
        try {
          const saveData = {
            type,
            demographics,
            responses,
            currentPage,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem('sri_assessment_progress', JSON.stringify(saveData));
          setLastSaved(new Date());
        } catch (error) {
          console.error('保存进度失败:', error);
        }
      }, 1000); // 1秒延迟保存

      return () => clearTimeout(saveTimer);
    }
  }, [responses, type, demographics, currentPage]);

  // 组件初始化时恢复进度
  useEffect(() => {
    const saved = localStorage.getItem('sri_assessment_progress');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.type === type) {
          setCurrentPage(data.currentPage || 0);
          // 注意：responses由父组件管理，这里只恢复页面状态
        }
      } catch (error) {
        console.error('恢复保存的进度时出错:', error);
      }
    }
  }, [type]);
  
  // 分页设置 - 完整版采用分页模式
  const usesPagination = type === 'full';
  const questionsPerPage = usesPagination ? 15 : allQuestions.length;
  const totalPages = usesPagination ? Math.ceil(allQuestions.length / questionsPerPage) : 1;
  
  // 获取当前页的题目
  const getCurrentPageQuestions = () => {
    if (!usesPagination) return allQuestions;
    const startIndex = currentPage * questionsPerPage;
    return allQuestions.slice(startIndex, startIndex + questionsPerPage);
  };
  
  const currentPageQuestions = getCurrentPageQuestions();

  // 获取指定题目的回答
  const getResponseForQuestion = (questionId: string) => {
    return responses.find(r => r.questionId === questionId);
  };

  // 处理回答
  const handleAnswer = (questionId: string, value: number) => {
    const response: Response = {
      questionId,
      value,
      timestamp: new Date()
    };

    const updatedResponses = responses.filter(r => r.questionId !== questionId);
    updatedResponses.push(response);
    onResponseUpdate(updatedResponses);
  };

  // 获取回答统计
  const getAnswerStats = () => {
    const answered = responses.length;
    const unanswered = allQuestions.length - answered;
    const requiredUnanswered = allQuestions
      .filter(q => q.required)
      .filter(q => !responses.some(r => r.questionId === q.id))
      .length;
    
    return { answered, unanswered, requiredUnanswered };
  };

  // 完成评估
  const handleComplete = () => {
    const stats = getAnswerStats();
    if (stats.requiredUnanswered > 0) {
      // 滚动到第一个未回答的必答题
      const firstUnanswered = allQuestions.find(q => 
        q.required && !responses.some(r => r.questionId === q.id)
      );
      if (firstUnanswered) {
        // 如果是分页模式，先跳转到对应页面
        if (usesPagination) {
          const questionIndex = allQuestions.findIndex(q => q.id === firstUnanswered.id);
          const targetPage = Math.floor(questionIndex / questionsPerPage);
          if (targetPage !== currentPage) {
            setCurrentPage(targetPage);
            setTimeout(() => {
              document.getElementById(`question-${firstUnanswered.id}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
            }, 100);
            return;
          }
        }
        
        document.getElementById(`question-${firstUnanswered.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
      
      alert(`还有 ${stats.requiredUnanswered} 道必答题未完成，请继续填写。`);
      return;
    }
    
    // 清除保存的进度
    localStorage.removeItem('sri_assessment_progress');
    onComplete();
  };

  // 按量表分组题目 - 根据分页模式调整
  const questionsByScale = scaleIds.reduce((acc, scaleId) => {
    const scale = ALL_SCALES[scaleId];
    if (scale) {
      if (usesPagination) {
        // 分页模式：只显示当前页的题目
        const scaleQuestionsOnPage = scale.questions.filter(q => 
          currentPageQuestions.some(pq => pq.id === q.id)
        );
        if (scaleQuestionsOnPage.length > 0) {
          acc[scaleId] = scaleQuestionsOnPage;
        }
      } else {
        acc[scaleId] = scale.questions;
      }
    }
    return acc;
  }, {} as Record<string, Question[]>);

  // 分页导航函数
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
      window.scrollTo(0, 0);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      window.scrollTo(0, 0);
    }
  };

  const canGoNext = currentPage < totalPages - 1;
  const canGoPrev = currentPage > 0;

  const stats = getAnswerStats();
  const progress = (stats.answered / allQuestions.length) * 100;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 顶部进度概览 */}
      <Card className="sri-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-psychology-primary" />
                问卷评估进度
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-psychology-primary">
                  {userGroup}
                </Badge>
                <Badge variant="outline">
                  {type === 'quick' ? '快测版' : '完整版'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-psychology-primary border-psychology-primary">
                {stats.answered} / {allQuestions.length} 已完成
              </Badge>
              {lastSaved && (
                <Badge variant="secondary" className="text-xs">
                  已保存 {lastSaved.toLocaleTimeString()}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} className="h-2" />
          
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.answered}</div>
              <div className="text-sm text-green-600">已回答</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.unanswered}</div>
              <div className="text-sm text-yellow-600">未回答</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.requiredUnanswered}</div>
              <div className="text-sm text-red-600">必答未完成</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 分页导航 - 仅在完整版显示 */}
      {usesPagination && (
        <Card className="sri-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={goToPrevPage}
                disabled={!canGoPrev}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                上一页
              </Button>

              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  第 {currentPage + 1} 页，共 {totalPages} 页
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentPage(i);
                        window.scrollTo(0, 0);
                      }}
                      className={`
                        w-8 h-8 rounded text-xs font-medium transition-colors
                        ${i === currentPage 
                          ? 'bg-psychology-primary text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }
                      `}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                onClick={goToNextPage}
                disabled={!canGoNext}
                className="flex items-center gap-2"
              >
                下一页
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 按量表分组显示题目 */}
      {Object.entries(questionsByScale).map(([scaleId, questions]) => {
        const scale = ALL_SCALES[scaleId];
        const scaleResponses = responses.filter(r => 
          questions.some(q => q.id === r.questionId)
        );
        const scaleProgress = (scaleResponses.length / questions.length) * 100;

        return (
          <Card key={scaleId} className="sri-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{scale.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {scale.description}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">
                    {scaleResponses.length} / {questions.length}
                  </Badge>
                  <Progress value={scaleProgress} className="h-1 w-20 mt-2" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {questions.map((question, index) => {
                const currentResponse = getResponseForQuestion(question.id);
                const isAnswered = !!currentResponse;
                
                return (
                  <div 
                    key={question.id}
                    id={`question-${question.id}`}
                    className={`
                      p-6 rounded-lg border-2 transition-all duration-200
                      ${isAnswered 
                        ? 'bg-green-50 border-green-200' 
                        : question.required 
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }
                    `}
                  >
                    {/* 题目头部 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {index + 1}
                          </Badge>
                          {question.required && (
                            <Badge variant="destructive" className="text-xs">
                              必答
                            </Badge>
                          )}
                          {isAnswered && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <h3 className="text-base font-medium text-foreground leading-relaxed">
                          {question.text}
                        </h3>
                        {question.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {question.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 横向选项布局 */}
                    <RadioGroup
                      value={currentResponse?.value.toString() || ''}
                      onValueChange={(value) => handleAnswer(question.id, parseInt(value))}
                      className="mt-4"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
                        {question.options.map((option) => {
                          const isSelected = currentResponse?.value === option.value;
                          
                          return (
                            <div 
                              key={option.value}
                              onClick={() => handleAnswer(question.id, option.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleAnswer(question.id, option.value);
                                }
                              }}
                              role="radio"
                              aria-checked={isSelected}
                              tabIndex={0}
                              className={`
                                flex items-center p-2 sm:p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:bg-white/50 select-none active:scale-[0.98]
                                ${isSelected 
                                  ? 'bg-white border-psychology-primary shadow-sm' 
                                  : 'bg-white/30 border-gray-300 hover:border-gray-400'
                                }
                              `}
                            >
                              <RadioGroupItem 
                                value={option.value.toString()} 
                                id={`${question.id}-option-${option.value}`}
                                className="shrink-0"
                              />
                              <Label 
                                htmlFor={`${question.id}-option-${option.value}`}
                                className="ml-2 sm:ml-3 cursor-pointer text-xs sm:text-sm font-medium flex-1 leading-tight"
                              >
                                {option.label}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </RadioGroup>

                    {/* 必答题提醒 */}
                    {question.required && !isAnswered && (
                      <div className="flex items-center gap-2 mt-3 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">此题为必答题</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* 底部操作区域 */}
      <Card className="sri-card">
        <CardContent className="p-6">
          <div className="flex justify-between items-center">
            <Button 
              variant="outline"
              onClick={onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回上一步
            </Button>

            <div className="text-center">
              {usesPagination && stats.requiredUnanswered > 0 && (
                <p className="text-sm text-amber-600 mb-2">
                  还有未完成的题目，请继续填写或查看其他页面
                </p>
              )}
              {!usesPagination && (
                <p className="text-sm text-muted-foreground mb-2">
                  请确保所有必答题都已完成
                </p>
              )}
              <Button 
                onClick={handleComplete}
                disabled={stats.requiredUnanswered > 0}
                className="bg-psychology-primary hover:bg-psychology-primary/90 px-8"
                size="lg"
              >
                完成评估并查看结果
                <CheckCircle className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                进度: {Math.round(progress)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.requiredUnanswered > 0 
                  ? `还有 ${stats.requiredUnanswered} 道必答题`
                  : '所有必答题已完成'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 底部说明 */}
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
          请根据您的真实感受选择最符合的选项。所有回答都将被严格保密，仅用于生成您的个人评估报告。
          您可以随时修改之前的回答。
        </p>
      </div>
    </div>
  );
}